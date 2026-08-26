//! Resolve which instance world the player is in while the embedded server is running.
//!
//! Signal priority when the Hytale server log is recent or Bridge port is open:
//! 1. Server log add/remove stack — last world the player was added to without leaving
//! 2. Player save PerWorldData — world whose LastPosition matches live Transform
//! 3. Instance folder activity — universe/worlds/instance-* with newest writes
//! 4. PlayerData.World — often stale after instance hops
//!
//! Labels always come from that world's config.json WorldGen.WorldStructure (not folder slug).

use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::Serialize;
use serde_json::Value;

use crate::world_config::{label_from_world_config, read_world_config};

const POSITION_EPS: f64 = 1.0;
/// Hytale still writing logs — treat membership stack as live.
const LOG_SESSION_MAX_AGE_SECS: u64 = 300;
const LOG_TAIL_BYTES: u64 = 4 * 1024 * 1024;

pub fn newest_server_log_path(save_root: &Path) -> Option<PathBuf> {
    let logs_dir = save_root.join("logs");
    let mut log_files: Vec<PathBuf> = std::fs::read_dir(&logs_dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.contains("_server.") && n.ends_with(".log"))
        })
        .collect();
    log_files.sort_by_key(|p| {
        std::fs::metadata(p)
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH)
    });
    log_files.pop()
}

/// True when the embedded Hytale server was writing logs recently (game session).
pub fn hytale_server_session_active(save_root: &Path) -> bool {
    let Some(path) = newest_server_log_path(save_root) else {
        return false;
    };
    let Ok(meta) = std::fs::metadata(&path) else {
        return false;
    };
    let Ok(modified) = meta.modified() else {
        return false;
    };
    modified
        .elapsed()
        .map(|e| e.as_secs() <= LOG_SESSION_MAX_AGE_SECS)
        .unwrap_or(false)
}

pub fn prefer_live_world_signals(save_root: &Path, bridge_port_open: bool) -> bool {
    bridge_port_open || hytale_server_session_active(save_root)
}

fn read_log_tail(path: &Path, max_bytes: u64) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let start = len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut buf = String::new();
    file.read_to_string(&mut buf).ok()?;
    if start > 0 {
        if let Some(idx) = buf.find('\n') {
            buf.drain(..=idx);
        }
    }
    Some(buf)
}

fn parse_transform_position_triple(line: &str) -> Option<(f64, f64, f64)> {
    let marker = "Transform{position=(";
    let start = line.find(marker)? + marker.len();
    let rest = &line[start..];
    let close = rest.find(')')?;
    let inner = rest[..close].trim();
    let parts: Vec<f64> = inner
        .split_whitespace()
        .filter_map(|p| p.parse::<f64>().ok())
        .collect();
    if parts.len() >= 3 {
        Some((parts[0], parts[1], parts[2]))
    } else {
        None
    }
}

/// Newest position for `world_id` from server log (join lines and in-world Add/Transform).
pub fn last_position_for_world_from_log(log_text: &str, world_id: &str) -> Option<(f64, f64, f64)> {
    let join_marker = format!("joined world '{world_id}'");
    let add_marker = format!("to world '{world_id}'");
    for line in log_text.lines().rev() {
        if line.contains(&join_marker) {
            if let Some(pos) = parse_log_location_triple(line) {
                return Some(pos);
            }
        }
        if line.contains("Adding player '") && line.contains(&add_marker) {
            if let Some(pos) = parse_transform_position_triple(line) {
                return Some(pos);
            }
        }
    }
    None
}

fn membership_stack_from_log_text(content: &str) -> Option<String> {
    let mut current: Option<String> = None;
    for line in content.lines() {
        if line.contains("Adding player '") && line.contains("to world '") {
            if let Some(w) = extract_adding_player_world(line) {
                current = Some(w);
            }
        } else if line.contains("Removing player '") && line.contains("from world '") {
            if let Some(w) = extract_removing_player_world(line) {
                if current.as_deref() == Some(w.as_str()) {
                    current = None;
                }
            }
        } else if let Some(w) = extract_joined_instance_world(line) {
            current = Some(w);
        }
    }
    current
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceWorldStatus {
    pub world_id: String,
    pub label: String,
    pub world_structure: Option<String>,
    /// True when server log membership stack says the player is here now.
    pub is_live: bool,
}

#[derive(Debug, Clone)]
pub struct ResolvedPlayer {
    pub name: String,
    pub uuid: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub z: Option<f64>,
    /// How block coords were resolved: per_world, server_log, player_save.
    pub position_source: Option<&'static str>,
    pub world_id: String,
    pub label: String,
    pub world_structure: Option<String>,
    pub source: &'static str,
    /// Raw PlayerData.World (can lag behind the log stack).
    pub save_world_id: Option<String>,
    pub hytale_session_active: bool,
    pub player_world_live: bool,
    /// How the player file was chosen: "preferred" (matched a caller-supplied
    /// UUID) or "newest_file" (mtime heuristic fallback).
    pub uuid_source: &'static str,
}

fn extract_world_from_quoted_after(line: &str, marker: &str) -> Option<String> {
    let start = line.find(marker)? + marker.len();
    let rest = &line[start..];
    let end = rest.find('\'')?;
    let id = &rest[..end];
    if id.starts_with("instance-") || id == "default" {
        Some(id.to_string())
    } else {
        None
    }
}

fn extract_adding_player_world(line: &str) -> Option<String> {
    if line.contains("Adding player '") && line.contains("to world '") {
        extract_world_from_quoted_after(line, "to world '")
    } else {
        None
    }
}

fn extract_removing_player_world(line: &str) -> Option<String> {
    if line.contains("Removing player '") && line.contains("from world '") {
        extract_world_from_quoted_after(line, "from world '")
    } else {
        None
    }
}

fn extract_joined_instance_world(line: &str) -> Option<String> {
    extract_world_from_quoted_after(line, "joined world '")
}

fn parse_log_location_triple(line: &str) -> Option<(f64, f64, f64)> {
    let start = line.find("at location")? + "at location".len();
    let rest = line[start..].trim();
    let open = rest.find('(')? + 1;
    let close = rest.find(')')?;
    let inner = rest[open..close].trim();
    let parts: Vec<f64> = inner
        .split_whitespace()
        .filter_map(|p| p.parse::<f64>().ok())
        .collect();
    if parts.len() >= 3 {
        Some((parts[0], parts[1], parts[2]))
    } else {
        None
    }
}

/// Replay add/remove/join from the tail of the newest `*_server.log` only.
pub fn current_world_from_log_stack(save_root: &Path) -> Option<String> {
    let log_path = newest_server_log_path(save_root)?;
    let content = read_log_tail(&log_path, LOG_TAIL_BYTES)
        .or_else(|| std::fs::read_to_string(&log_path).ok())?;
    membership_stack_from_log_text(&content)
}

fn max_mtime_under(dir: &Path) -> SystemTime {
    let mut best = SystemTime::UNIX_EPOCH;
    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return best;
    };
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Ok(m) = entry.metadata().and_then(|meta| meta.modified()) {
                if m > best {
                    best = m;
                }
            }
        } else if path.is_dir() {
            let nested = max_mtime_under(&path);
            if nested > best {
                best = nested;
            }
        }
    }
    best
}

pub fn most_recent_instance_world(save_root: &Path) -> Option<String> {
    let worlds_dir = save_root.join("universe").join("worlds");
    let mut best: Option<(SystemTime, String)> = None;
    for entry in std::fs::read_dir(&worlds_dir).ok()?.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with("instance-") {
            continue;
        }
        let mtime = max_mtime_under(&path);
        match &best {
            Some((prev, _)) if mtime <= *prev => {}
            _ => best = Some((mtime, name)),
        }
    }
    best.map(|(_, name)| name)
}

/// Lowercase and strip hyphens so dashed and undashed UUID spellings compare
/// equal. Save filenames and the `profile.uuid` claim are not guaranteed to
/// agree on formatting, and a naive compare would silently fall through to the
/// mtime heuristic — looking like the preference feature simply does not work.
fn normalize_uuid(raw: &str) -> String {
    raw.chars()
        .filter(|c| *c != '-')
        .flat_map(char::to_lowercase)
        .collect()
}

/// Player file whose filename stem matches `uuid`, ignoring case and hyphens.
pub fn player_file_for_uuid(players_dir: &Path, uuid: &str) -> Option<PathBuf> {
    let want = normalize_uuid(uuid);
    if want.is_empty() {
        return None;
    }
    for entry in std::fs::read_dir(players_dir).ok()?.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }
        let matches = path
            .file_stem()
            .and_then(|s| s.to_str())
            .is_some_and(|stem| normalize_uuid(stem) == want);
        if matches {
            return Some(path);
        }
    }
    None
}

pub fn active_player_file(players_dir: &Path) -> Option<PathBuf> {
    let mut best: Option<(SystemTime, PathBuf)> = None;
    for entry in std::fs::read_dir(players_dir).ok()?.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let mtime = meta
            .modified()
            .or_else(|_| meta.created())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        match &best {
            Some((prev, _)) if mtime <= *prev => {}
            _ => best = Some((mtime, path)),
        }
    }
    best.map(|(_, p)| p)
}

fn positions_close(a: (f64, f64, f64), pos: &Value) -> bool {
    let x = pos.get("X").and_then(|v| v.as_f64());
    let y = pos.get("Y").and_then(|v| v.as_f64());
    let z = pos.get("Z").and_then(|v| v.as_f64());
    match (x, y, z) {
        (Some(x), Some(y), Some(z)) => {
            (a.0 - x).abs() <= POSITION_EPS
                && (a.1 - y).abs() <= POSITION_EPS
                && (a.2 - z).abs() <= POSITION_EPS
        }
        _ => false,
    }
}

fn is_stale_hub_world(world_id: &str) -> bool {
    world_id.contains("Unknown_Worlds")
}

fn world_from_per_world_data(
    transform: (f64, f64, f64),
    per_world: &Value,
    skip_hub_worlds: bool,
) -> Option<String> {
    let map = per_world.as_object()?;
    let mut best: Option<(f64, String)> = None;
    for (world_id, data) in map {
        if skip_hub_worlds && is_stale_hub_world(world_id) {
            continue;
        }
        let Some(pos) = data.get("LastPosition") else {
            continue;
        };
        if !positions_close(transform, pos) {
            continue;
        }
        let x = pos.get("X").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let y = pos.get("Y").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let z = pos.get("Z").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let dist =
            (transform.0 - x).powi(2) + (transform.1 - y).powi(2) + (transform.2 - z).powi(2);
        match &best {
            Some((d, _)) if dist >= *d => {}
            _ => best = Some((dist, world_id.clone())),
        }
    }
    best.map(|(_, id)| id)
}

pub fn list_instance_worlds(
    save_root: &Path,
    live_world_id: Option<&str>,
) -> Vec<InstanceWorldStatus> {
    let worlds_dir = save_root.join("universe").join("worlds");
    let mut out: Vec<InstanceWorldStatus> = Vec::new();
    let Ok(read_dir) = std::fs::read_dir(&worlds_dir) else {
        return out;
    };
    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with("instance-") {
            continue;
        }
        let cfg = read_world_config(save_root, &name);
        out.push(InstanceWorldStatus {
            is_live: live_world_id == Some(name.as_str()),
            label: label_from_world_config(&cfg),
            world_structure: cfg.world_structure,
            world_id: name,
        });
    }
    if let Some(live_id) = live_world_id {
        if !out.iter().any(|i| i.world_id == live_id) {
            let cfg = read_world_config(save_root, live_id);
            out.push(InstanceWorldStatus {
                world_id: live_id.to_string(),
                label: label_from_world_config(&cfg),
                world_structure: cfg.world_structure,
                is_live: true,
            });
        }
    }
    out.sort_by(|a, b| {
        b.is_live
            .cmp(&a.is_live)
            .then_with(|| a.label.cmp(&b.label))
    });
    out
}

fn position_from_per_world_entry(data: &Value) -> Option<(f64, f64, f64)> {
    let pos = data.get("LastPosition")?;
    let x = pos.get("X").and_then(|v| v.as_f64())?;
    let y = pos.get("Y").and_then(|v| v.as_f64())?;
    let z = pos.get("Z").and_then(|v| v.as_f64())?;
    Some((x, y, z))
}

/// Resolve the active player, falling back to the newest-mtime player file.
///
/// Kept at its original signature so existing callers (the sidecar, the Java
/// plugin's Rust-side helpers) need no change and see no behaviour difference.
pub fn resolve_player(save_root: &Path, bridge_port_open: bool) -> Option<ResolvedPlayer> {
    resolve_player_preferring(save_root, bridge_port_open, None)
}

/// As [`resolve_player`], but prefers the player file matching `preferred_uuid`
/// when one exists.
///
/// A `None` UUID, or one with no matching file, is a strict no-op: resolution
/// falls back to [`active_player_file`]'s newest-mtime heuristic exactly as
/// before. Callers can tell which path ran via [`ResolvedPlayer::uuid_source`].
pub fn resolve_player_preferring(
    save_root: &Path,
    bridge_port_open: bool,
    preferred_uuid: Option<&str>,
) -> Option<ResolvedPlayer> {
    let use_live_signals = prefer_live_world_signals(save_root, bridge_port_open);
    let session_active = hytale_server_session_active(save_root);
    let players_dir = save_root.join("universe").join("players");
    let preferred = preferred_uuid.and_then(|u| player_file_for_uuid(&players_dir, u));
    let uuid_source = if preferred.is_some() {
        "preferred"
    } else {
        "newest_file"
    };
    let path = match preferred {
        Some(p) => p,
        None => active_player_file(&players_dir)?,
    };
    let uuid = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();
    let raw = std::fs::read_to_string(&path).ok()?;
    let json: Value = serde_json::from_str(&raw).ok()?;
    let components = json.get("Components")?;

    let name = components
        .get("Nameplate")
        .and_then(|n| n.get("Text"))
        .and_then(|t| t.as_str())
        .unwrap_or("Player")
        .to_string();

    let transform = components
        .get("Transform")
        .and_then(|t| t.get("Position"))
        .and_then(|pos| {
            let x = pos.get("X").and_then(|v| v.as_f64())?;
            let y = pos.get("Y").and_then(|v| v.as_f64())?;
            let z = pos.get("Z").and_then(|v| v.as_f64())?;
            Some((x, y, z))
        });
    let (tx, ty, tz) = match transform {
        Some((x, y, z)) => (Some(x), Some(y), Some(z)),
        None => (None, None, None),
    };

    let save_world_id = components
        .get("Player")
        .and_then(|p| p.get("PlayerData"))
        .and_then(|pd| pd.get("World"))
        .and_then(|w| w.as_str())
        .map(|s| s.to_string());

    let per_world = components
        .get("Player")
        .and_then(|p| p.get("PlayerData"))
        .and_then(|pd| pd.get("PerWorldData"));

    let log_world = use_live_signals
        .then(|| current_world_from_log_stack(save_root))
        .flatten();
    let from_per_world = transform
        .and_then(|t| per_world.and_then(|pw| world_from_per_world_data(t, pw, use_live_signals)));
    let from_activity = use_live_signals
        .then(|| most_recent_instance_world(save_root))
        .flatten();
    let from_save = save_world_id.as_deref().unwrap_or("default");

    let (world_id, source) = if let Some(w) = log_world {
        (w, "server_log_membership")
    } else if let Some(w) = from_per_world {
        (w, "player_per_world_position")
    } else if let Some(w) = from_activity {
        if w != from_save || (use_live_signals && is_stale_hub_world(from_save)) {
            (w, "recent_world_activity")
        } else {
            (from_save.to_string(), "player_save")
        }
    } else if use_live_signals && is_stale_hub_world(from_save) {
        let w = most_recent_instance_world(save_root).unwrap_or_else(|| from_save.to_string());
        if w != from_save {
            (w, "recent_world_activity")
        } else {
            (from_save.to_string(), "player_save")
        }
    } else {
        (from_save.to_string(), "player_save")
    };

    let log_tail = newest_server_log_path(save_root).and_then(|p| {
        read_log_tail(&p, LOG_TAIL_BYTES).or_else(|| std::fs::read_to_string(&p).ok())
    });

    let (x, y, z, position_source) = {
        let from_log = log_tail
            .as_deref()
            .and_then(|text| last_position_for_world_from_log(text, &world_id));
        let from_per_world_active = per_world
            .and_then(|pw| pw.get(&world_id))
            .and_then(position_from_per_world_entry);
        let save_matches_world = save_world_id.as_deref() == Some(world_id.as_str());

        // PerWorldData updates when the save flushes — best for walking in the active instance.
        if let Some((px, py, pz)) = from_per_world_active {
            (Some(px), Some(py), Some(pz), Some("per_world"))
        } else if let Some((px, py, pz)) = from_log {
            (Some(px), Some(py), Some(pz), Some("server_log"))
        } else if save_matches_world {
            (tx, ty, tz, Some("player_save"))
        } else {
            (None, None, None, None)
        }
    };

    let player_world_live = source == "server_log_membership" && session_active;

    let cfg = read_world_config(save_root, &world_id);
    Some(ResolvedPlayer {
        name,
        uuid,
        x,
        y,
        z,
        position_source,
        label: label_from_world_config(&cfg),
        world_structure: cfg.world_structure,
        world_id,
        source,
        save_world_id,
        hytale_session_active: session_active,
        player_world_live,
        uuid_source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a save with the given player UUIDs, written oldest-first so the
    /// last entry is the newest-mtime file the heuristic would pick.
    fn save_with_players(tag: &str, uuids: &[&str]) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("tn-player-pref-{}-{}", tag, std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let players = root.join("universe").join("players");
        std::fs::create_dir_all(&players).unwrap();
        for (i, uuid) in uuids.iter().enumerate() {
            if i > 0 {
                // Ensure a strictly newer mtime than the previous file.
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            let json = serde_json::json!({
                "Components": {
                    "Nameplate": { "Text": format!("Player{}", i) },
                    "Transform": { "Position": { "X": 1.0, "Y": 2.0, "Z": 3.0 } },
                    "Player": { "PlayerData": { "World": "default" } }
                }
            });
            std::fs::write(
                players.join(format!("{}.json", uuid)),
                serde_json::to_string(&json).unwrap(),
            )
            .unwrap();
        }
        root
    }

    const OLDER: &str = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const NEWER: &str = "11111111-2222-3333-4444-555555555555";

    /// Diagnostic against a real Hytale save. Ignored by default so CI and
    /// other machines never depend on local game data. Run with:
    ///   TN_SAVE_ROOT="/path/to/Saves/Name" TN_UUID="<profile-uuid>" \
    ///     cargo test -p bridge-save real_save -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_save_prefers_the_signed_in_profile() {
        let Ok(root) = std::env::var("TN_SAVE_ROOT") else {
            eprintln!("set TN_SAVE_ROOT to run this");
            return;
        };
        let root = PathBuf::from(root);
        let want = std::env::var("TN_UUID").ok();

        let heuristic = resolve_player(&root, false).expect("no player resolved");
        println!("newest-file heuristic -> {} ({})", heuristic.uuid, heuristic.name);

        if let Some(want) = want {
            let preferred =
                resolve_player_preferring(&root, false, Some(&want)).expect("no player resolved");
            println!("preferred            -> {} ({})", preferred.uuid, preferred.name);
            println!("uuid_source          -> {}", preferred.uuid_source);
            assert_eq!(preferred.uuid_source, "preferred");
            assert_eq!(
                preferred.uuid.replace('-', "").to_lowercase(),
                want.replace('-', "").to_lowercase()
            );
            if heuristic.uuid != preferred.uuid {
                println!("*** heuristic would have targeted the WRONG player ***");
            }
        }
    }

    #[test]
    fn prefers_matching_uuid_over_newest_file() {
        let root = save_with_players("prefers", &[OLDER, NEWER]);
        let p = resolve_player_preferring(&root, false, Some(OLDER)).unwrap();
        assert_eq!(p.uuid, OLDER);
        assert_eq!(p.uuid_source, "preferred");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn falls_back_to_newest_when_uuid_does_not_match() {
        let root = save_with_players("unmatched", &[OLDER, NEWER]);
        let p =
            resolve_player_preferring(&root, false, Some("99999999-9999-9999-9999-999999999999"))
                .unwrap();
        assert_eq!(p.uuid, NEWER);
        assert_eq!(p.uuid_source, "newest_file");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn resolve_player_is_unchanged_without_a_preference() {
        let root = save_with_players("nopref", &[OLDER, NEWER]);
        let plain = resolve_player(&root, false).unwrap();
        let explicit_none = resolve_player_preferring(&root, false, None).unwrap();
        assert_eq!(plain.uuid, NEWER);
        assert_eq!(plain.uuid_source, "newest_file");
        assert_eq!(plain.uuid, explicit_none.uuid);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn matches_uuid_ignoring_hyphens_and_case() {
        let root = save_with_players("normalize", &[OLDER, NEWER]);
        // Undashed + uppercase spelling of the older file's dashed, lowercase name.
        let p = resolve_player_preferring(&root, false, Some("AAAAAAAABBBBCCCCDDDDEEEEEEEEEEEE"))
            .unwrap();
        assert_eq!(p.uuid, OLDER);
        assert_eq!(p.uuid_source, "preferred");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn player_file_for_uuid_rejects_empty_and_unknown() {
        let root = save_with_players("lookup", &[OLDER]);
        let players = root.join("universe").join("players");
        assert!(player_file_for_uuid(&players, "").is_none());
        assert!(player_file_for_uuid(&players, "-  -").is_none());
        assert!(player_file_for_uuid(&players, NEWER).is_none());
        assert!(player_file_for_uuid(&players, OLDER).is_some());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn parses_transform_position_from_add_line() {
        let line = "[INFO] Adding player 'McCal' to world 'instance-Autmn Forest-0e10c9af-a5f0-48d6-8879-5ecc7c2073da' at location Transform{position=( 4.070E+2  6.500E+1  8.800E+1), rotation=Rotation3f{x=0.0, y=0.0, z=0.0}}";
        let pos = parse_transform_position_triple(line).unwrap();
        assert!((pos.0 - 407.0).abs() < 1.0);
        assert!((pos.1 - 65.0).abs() < 1.0);
        assert!((pos.2 - 88.0).abs() < 1.0);
    }

    #[test]
    fn log_stack_tracks_add_remove() {
        let lines = [
            "[INFO] Adding player 'McCal' to world 'instance-Unknown_Worlds-484eb8a8-c59e-4111-a438-6182ce3f9d36'",
            "[INFO] Removing player 'McCal' from world 'instance-Unknown_Worlds-484eb8a8-c59e-4111-a438-6182ce3f9d36'",
            "[INFO] Adding player 'McCal' to world 'instance-Autmn Forest-2ae1826d-8e82-4927-806b-5beaa8d96ff0'",
        ];
        let mut current = None;
        for line in lines {
            if line.contains("Adding player '") && line.contains("to world '") {
                current = extract_adding_player_world(line);
            } else if line.contains("from world '") {
                if let Some(w) = extract_removing_player_world(line) {
                    if current.as_deref() == Some(w.as_str()) {
                        current = None;
                    }
                }
            }
        }
        assert_eq!(
            current.as_deref(),
            Some("instance-Autmn Forest-2ae1826d-8e82-4927-806b-5beaa8d96ff0")
        );
    }

    #[test]
    fn parses_log_location_triple() {
        let line = "[INFO] Player 'McCal' joined world 'instance-X' at location (-9.860E+2  6.273E+1  5.548E+2)";
        let p = parse_log_location_triple(line).unwrap();
        assert!((p.0 + 986.0).abs() < 1.0);
        assert!((p.1 - 62.73).abs() < 0.1);
    }

    /// Regression against a real save layout (skipped when Worldgen V1 is absent).
    #[test]
    fn worldgen_v1_live_world_uses_log_not_stale_player_save() {
        let appdata = match std::env::var_os("APPDATA") {
            Some(a) => PathBuf::from(a),
            None => return,
        };
        let save = appdata
            .join("Hytale")
            .join("UserData")
            .join("Saves")
            .join("Worldgen V1");
        if !save.is_dir() {
            return;
        }
        let live = match resolve_player(&save, true) {
            Some(l) => l,
            None => return,
        };
        let stack = current_world_from_log_stack(&save);
        if let Some(expected) = stack {
            assert_eq!(
                live.world_id, expected,
                "live world should match log membership stack"
            );
            assert_eq!(live.source, "server_log_membership");
            if hytale_server_session_active(&save) {
                assert!(live.player_world_live);
            }
        }
        if live.label.eq_ignore_ascii_case("Unknown_Worlds")
            && live
                .save_world_id
                .as_deref()
                .is_some_and(|id| id.contains("Unknown_Worlds"))
        {
            panic!(
                "live label should not stay Unknown_Worlds when save world id is stale; got {:?} source={}",
                live.label, live.source
            );
        }
        let instances = list_instance_worlds(&save, Some(live.world_id.as_str()));
        assert!(
            instances.iter().any(|i| i.is_live),
            "instance list should mark one live world"
        );
        if let Some(tail) = newest_server_log_path(&save).and_then(|p| {
            read_log_tail(&p, LOG_TAIL_BYTES).or_else(|| std::fs::read_to_string(&p).ok())
        }) {
            if let Some(expected) = last_position_for_world_from_log(&tail, &live.world_id) {
                assert!(
                    live.x.is_some() && live.z.is_some(),
                    "expected coords for {}; live x={:?} y={:?} z={:?}",
                    live.world_id,
                    live.x,
                    live.y,
                    live.z
                );
                // PerWorldData is fresher than log tail when the save has flushed recently.
                // Only compare to log coordinates when log is the active position source.
                if live.position_source == Some("server_log") {
                    let (lx, ly, lz) = (live.x.unwrap(), live.y.unwrap(), live.z.unwrap());
                    assert!(
                        (lx - expected.0).abs() < 2.0
                            && (ly - expected.1).abs() < 2.0
                            && (lz - expected.2).abs() < 2.0,
                        "live position {:?} should match log {:?}",
                        (lx, ly, lz),
                        expected
                    );
                }
            }
        }
    }
}
