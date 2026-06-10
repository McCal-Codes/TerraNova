use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::hytale_assets;
use super::path_scope;
use super::template;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackWizardConfig {
    pub target_path: String,
    pub pack_group: String,
    pub pack_name: String,
    pub world_structure_template: String,
    pub biome_name: String,
    pub biome_template: String,
    pub include_starter_props: bool,
    pub starter_prefab_path: Option<String>,
    pub primary_material_block_id: Option<String>,
    pub atmosphere_mode: String,
    pub atmosphere_import_id: Option<String>,
    pub instance_name: String,
    pub game_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackWizardResult {
    pub biome_file_path: String,
    pub atmosphere_import_fallback: bool,
    pub environment_file_path: Option<String>,
    pub weather_file_path: Option<String>,
}

pub fn create_pack_wizard(
    config: PackWizardConfig,
    resource_dir: Option<PathBuf>,
) -> Result<PackWizardResult, Box<dyn std::error::Error>> {
    let target = Path::new(&config.target_path);
    path_scope::register_allowed_root(target);

    if target.exists()
        && fs::read_dir(target)
            .map_err(|e| e.to_string())?
            .next()
            .is_some()
    {
        return Err("Target directory is not empty".into());
    }

    let biome_name = slugify_identifier(&config.biome_name);
    let instance_name = slugify_identifier(&config.instance_name);
    if biome_name.is_empty() || instance_name.is_empty() {
        return Err("Biome and instance names must not be empty".into());
    }

    let server = target.join("Server");
    let gen = server.join("HytaleGenerator");
    for sub in &["Biomes", "Settings", "WorldStructures"] {
        fs::create_dir_all(gen.join(sub))?;
    }

    write_settings(&gen)?;

    let world = load_world_structure(&config.world_structure_template, resource_dir.clone())?;
    let world = patch_world_structure_biome_refs(world, &biome_name);
    fs::write(
        gen.join("WorldStructures/MainWorld.json"),
        serde_json::to_string_pretty(&world)?,
    )?;

    let mut biome = load_biome_template(&config.biome_template, resource_dir.clone())?;
    biome = patch_biome_document(biome, &biome_name, config.include_starter_props);
    biome = patch_biome_starter_prefab(
        biome,
        config.include_starter_props,
        config.starter_prefab_path.as_deref(),
    );
    biome = patch_primary_material(
        biome,
        config.primary_material_block_id.as_deref(),
        &config.biome_template,
    );

    let mut atmosphere_import_fallback = false;
    let mut environment_file_path: Option<String> = None;
    let mut weather_file_path: Option<String> = None;

    let environment_id = match config.atmosphere_mode.as_str() {
        "custom" => {
            let env_id = format!("Env_{biome_name}");
            let weather_id = format!("Weather_{biome_name}");
            write_custom_atmosphere(&server, &env_id, &weather_id)?;
            environment_file_path = Some(
                server
                    .join("Environments")
                    .join(format!("{env_id}.json"))
                    .to_string_lossy()
                    .to_string(),
            );
            weather_file_path = Some(
                server
                    .join("Weathers")
                    .join(format!("{weather_id}.json"))
                    .to_string_lossy()
                    .to_string(),
            );
            biome["EnvironmentProvider"] = json!({
                "Type": "Constant",
                "Environment": env_id
            });
            env_id
        }
        "import" => {
            let import_id = config
                .atmosphere_import_id
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or("Env_Zone1_Forests");
            if try_import_atmosphere(&server, import_id).is_ok() {
                let env_dest = server
                    .join("Environments")
                    .join(format!("{import_id}.json"));
                environment_file_path = Some(env_dest.to_string_lossy().to_string());
                let raw = fs::read_to_string(&env_dest)?;
                let doc: Value = serde_json::from_str(&raw)?;
                if let Some(weather_id) = doc
                    .get("WeatherForecasts")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|e| e.get("Weather"))
                    .and_then(|w| w.as_str())
                {
                    weather_file_path = Some(
                        server
                            .join("Weathers")
                            .join(format!("{weather_id}.json"))
                            .to_string_lossy()
                            .to_string(),
                    );
                }
                biome["EnvironmentProvider"] = json!({
                    "Type": "Constant",
                    "Environment": import_id
                });
                import_id.to_string()
            } else {
                atmosphere_import_fallback = true;
                let env_id = format!("Env_{biome_name}");
                let weather_id = format!("Weather_{biome_name}");
                write_custom_atmosphere(&server, &env_id, &weather_id)?;
                environment_file_path = Some(
                    server
                        .join("Environments")
                        .join(format!("{env_id}.json"))
                        .to_string_lossy()
                        .to_string(),
                );
                weather_file_path = Some(
                    server
                        .join("Weathers")
                        .join(format!("{weather_id}.json"))
                        .to_string_lossy()
                        .to_string(),
                );
                biome["EnvironmentProvider"] = json!({
                    "Type": "Constant",
                    "Environment": env_id
                });
                env_id
            }
        }
        _ => {
            biome["EnvironmentProvider"] = json!({
                "Type": "Constant",
                "Environment": "default"
            });
            "default".to_string()
        }
    };

    let biome_path = gen.join("Biomes").join(format!("{biome_name}.json"));
    fs::write(&biome_path, serde_json::to_string_pretty(&biome)?)?;

    let instances_dir = server.join("Instances").join(&instance_name);
    fs::create_dir_all(&instances_dir)?;
    let instance = build_instance_doc(&config.game_mode);
    fs::write(
        instances_dir.join("instance.bson"),
        serde_json::to_string_pretty(&instance)?,
    )?;

    let hytale_name = slugify_hytale_mod_name(&config.pack_name);
    let manifest = json!({
        "name": config.pack_name.trim(),
        "version": "1.0.0",
        "description": format!("Worldgen pack created by TerraNova Create Pack wizard"),
        "hytaleGroup": config.pack_group.trim(),
        "hytaleName": hytale_name,
    });
    fs::write(
        target.join("manifest.json"),
        serde_json::to_string_pretty(&manifest)?,
    )?;

    let _ = environment_id;

    Ok(PackWizardResult {
        biome_file_path: biome_path.to_string_lossy().to_string(),
        atmosphere_import_fallback,
        environment_file_path,
        weather_file_path,
    })
}

fn slugify_identifier(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let mut out = String::new();
    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            out.push(ch);
        } else if ch.is_whitespace() || ch == '-' {
            if !out.ends_with('_') && !out.is_empty() {
                out.push('_');
            }
        }
    }
    while out.starts_with('_') {
        out.remove(0);
    }
    while out.ends_with('_') {
        out.pop();
    }
    if out.is_empty() {
        return "Unnamed".to_string();
    }
    if out.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        return format!("Biome_{out}");
    }
    out
}

fn slugify_hytale_mod_name(value: &str) -> String {
    let parts: Vec<String> = value
        .trim()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();
    if parts.is_empty() {
        return "My-Pack".to_string();
    }
    parts.join("-")
}

fn write_settings(gen: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let settings = json!({
        "CustomConcurrency": -1,
        "BufferCapacityFactor": 0.3,
        "TargetViewDistance": 512.0,
        "TargetPlayerCount": 3.0,
        "StatsCheckpoints": []
    });
    fs::write(
        gen.join("Settings/Settings.json"),
        serde_json::to_string_pretty(&settings)?,
    )?;
    Ok(())
}

fn basic_world_structure() -> Value {
    json!({
        "Type": "NoiseRange",
        "DefaultBiome": "DefaultBiome",
        "DefaultTransitionDistance": 16,
        "MaxBiomeEdgeDistance": 32,
        "Biomes": [
            { "Biome": "DefaultBiome", "Min": -1.0, "Max": 1.0 }
        ],
        "Density": {
            "Type": "SimplexNoise2D",
            "Lacunarity": 2.0,
            "Persistence": 0.5,
            "Scale": 256.0,
            "Octaves": 1,
            "Seed": "main"
        },
        "Framework": []
    })
}

fn basic_biome() -> Value {
    json!({
        "Name": "DefaultBiome",
        "Terrain": {
            "Type": "DAOTerrain",
            "Density": {
                "Type": "Clamp",
                "Min": -1.0,
                "Max": 1.0,
                "Input": {
                    "Type": "LinearTransform",
                    "Scale": 40.0,
                    "Offset": 64.0,
                    "Input": {
                        "Type": "SimplexNoise2D",
                        "Frequency": 0.006,
                        "Amplitude": 1.0,
                        "Seed": 1,
                        "Octaves": 3,
                        "Lacunarity": 2.0,
                        "Gain": 0.5
                    }
                }
            }
        },
        "MaterialProvider": {
            "Type": "Constant",
            "Material": "Rock_Stone"
        },
        "Props": [],
        "EnvironmentProvider": { "Type": "Default" },
        "TintProvider": { "Type": "Constant", "Color": "#4a7c3f" }
    })
}

fn load_world_structure(
    template_id: &str,
    resource_dir: Option<PathBuf>,
) -> Result<Value, Box<dyn std::error::Error>> {
    if template_id == "basic" {
        return Ok(basic_world_structure());
    }
    let path =
        resolve_template_json_path(template_id, "WorldStructures/MainWorld.json", resource_dir)?;
    let raw = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw)?)
}

fn load_biome_template(
    template_id: &str,
    resource_dir: Option<PathBuf>,
) -> Result<Value, Box<dyn std::error::Error>> {
    if template_id == "basic" {
        return Ok(basic_biome());
    }
    if let Some(reference_name) = template_id.strip_prefix("reference:") {
        let templates_root = template::find_templates_root(resource_dir)?;
        let path = templates_root
            .join("references")
            .join(format!("{reference_name}.json"));
        if !path.is_file() {
            return Err(format!("Reference biome '{reference_name}' not found").into());
        }
        let raw = fs::read_to_string(path)?;
        return Ok(serde_json::from_str(&raw)?);
    }
    let biome_file = resolve_bundle_biome_relative(template_id, resource_dir.clone())?;
    let path = resolve_template_json_path(template_id, &biome_file, resource_dir)?;
    let raw = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw)?)
}

/// Folders excluded from wizard bundle discovery (dev sandboxes and reference exports).
const WIZARD_TEMPLATE_SKIP: &[&str] = &["references", "FirstTry", "FHillsTest"];

fn format_template_display_name(folder: &str) -> String {
    folder
        .split(|c: char| c == '-' || c == '_')
        .filter(|w| !w.is_empty())
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn resolve_bundle_biome_relative(
    template_folder: &str,
    resource_dir: Option<PathBuf>,
) -> Result<String, Box<dyn std::error::Error>> {
    let templates_root = template::find_templates_root(resource_dir)?;
    let biomes_dir = templates_root
        .join(template_folder)
        .join("Server")
        .join("HytaleGenerator")
        .join("Biomes");
    if !biomes_dir.is_dir() {
        return Err(format!("No Biomes folder for template '{template_folder}'").into());
    }
    let mut files: Vec<String> = Vec::new();
    for entry in fs::read_dir(&biomes_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file()
            && path
                .extension()
                .map(|e| e.eq_ignore_ascii_case("json"))
                .unwrap_or(false)
        {
            if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                files.push(format!("Biomes/{name}"));
            }
        }
    }
    files.sort();
    files
        .into_iter()
        .next()
        .ok_or_else(|| format!("No biome JSON in template '{template_folder}'").into())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackWizardBundleTemplate {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub biome_relative_path: String,
    pub has_world_structure: bool,
}

/// List bundled template folders suitable for the pack wizard (Simple + Advanced).
pub fn list_pack_wizard_bundle_templates(
    resource_dir: Option<PathBuf>,
) -> Result<Vec<PackWizardBundleTemplate>, Box<dyn std::error::Error>> {
    let templates_root = template::find_templates_root(resource_dir.clone())?;
    let mut out: Vec<PackWizardBundleTemplate> = Vec::new();

    for entry in fs::read_dir(&templates_root)? {
        let entry = entry?;
        if !entry.path().is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        if WIZARD_TEMPLATE_SKIP
            .iter()
            .any(|s| id.eq_ignore_ascii_case(s))
        {
            continue;
        }
        let biome_relative_path = match resolve_bundle_biome_relative(&id, resource_dir.clone()) {
            Ok(p) => p,
            Err(_) => continue,
        };
        let world_path = templates_root
            .join(&id)
            .join("Server/HytaleGenerator/WorldStructures/MainWorld.json");
        let has_world_structure = world_path.is_file();
        let display_name = format_template_display_name(&id);
        let description = bundle_template_description(&id);
        out.push(PackWizardBundleTemplate {
            id,
            display_name,
            description,
            biome_relative_path,
            has_world_structure,
        });
    }

    out.sort_by(|a, b| a.display_name.cmp(&b.display_name));
    Ok(out)
}

fn bundle_template_description(id: &str) -> String {
    match id {
        "void" => "Flat void platform — minimal terrain for testing.".to_string(),
        "forest-hills" => {
            "Rolling hills with material bands, caves, and optional starter props.".to_string()
        }
        "eldritch-spirelands" => {
            "Alien spire terrain with Voronoi ridges and monument props.".to_string()
        }
        "shattered-archipelago" => {
            "Island archipelago with sea caves and scattered prop placements.".to_string()
        }
        "tropical-pirate-islands" => {
            "Large Hytale-style tropical export — complex graphs; best for study or remix."
                .to_string()
        }
        _ => format!("Bundled TerraNova starter from templates/{id}."),
    }
}

fn resolve_template_json_path(
    template_folder: &str,
    relative_under_gen: &str,
    resource_dir: Option<PathBuf>,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let templates_root = template::find_templates_root(resource_dir)?;
    let path = templates_root
        .join(template_folder)
        .join("Server")
        .join("HytaleGenerator")
        .join(relative_under_gen);
    if path.is_file() {
        return Ok(path);
    }
    Err(format!("Template file not found: {}", path.display()).into())
}

fn patch_world_structure_biome_refs(mut world: Value, biome_name: &str) -> Value {
    if let Some(obj) = world.as_object_mut() {
        obj.insert("DefaultBiome".to_string(), json!(biome_name));
        if let Some(biomes) = obj.get_mut("Biomes").and_then(|v| v.as_array_mut()) {
            for entry in biomes.iter_mut() {
                if let Some(entry_obj) = entry.as_object_mut() {
                    entry_obj.insert("Biome".to_string(), json!(biome_name));
                }
            }
        }
    }
    world
}

fn patch_biome_document(mut biome: Value, biome_name: &str, include_starter_props: bool) -> Value {
    if let Some(obj) = biome.as_object_mut() {
        obj.insert("Name".to_string(), json!(biome_name));
        if !include_starter_props {
            obj.insert("Props".to_string(), json!([]));
        }
    }
    biome
}

fn patch_biome_starter_prefab(
    mut biome: Value,
    include_template_props: bool,
    custom_path: Option<&str>,
) -> Value {
    let Some(path) = custom_path.map(str::trim).filter(|s| !s.is_empty()) else {
        return biome;
    };
    let entry = minimal_prefab_prop(path);
    if let Some(obj) = biome.as_object_mut() {
        if include_template_props {
            if let Some(props) = obj.get_mut("Props").and_then(|v| v.as_array_mut()) {
                props.push(entry);
            } else {
                obj.insert("Props".to_string(), json!([entry]));
            }
        } else {
            obj.insert("Props".to_string(), json!([entry]));
        }
    }
    biome
}

fn minimal_prefab_prop(path: &str) -> Value {
    json!({
        "Runtime": 0,
        "Skip": false,
        "Positions": {
            "Type": "Mesh2D",
            "Resolution": 6,
            "Jitter": 0.3
        },
        "Assignments": {
            "Type": "Constant",
            "Prop": {
                "Type": "Prefab",
                "Path": path,
                "Directionality": { "Type": "Uniform" },
                "Scanner": {
                    "Type": "ColumnLinear",
                    "StepSize": 1,
                    "Range": { "Min": 0, "Max": 200 }
                }
            }
        }
    })
}

fn patch_primary_material(mut biome: Value, block_id: Option<&str>, template_id: &str) -> Value {
    let Some(id) = block_id.map(str::trim).filter(|s| !s.is_empty()) else {
        return biome;
    };
    if template_id != "basic" {
        return biome;
    }
    if let Some(obj) = biome.as_object_mut() {
        obj.insert(
            "MaterialProvider".to_string(),
            json!({
                "Type": "Constant",
                "Material": id
            }),
        );
    }
    biome
}

fn write_custom_atmosphere(
    server: &Path,
    env_id: &str,
    weather_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let env_dir = server.join("Environments");
    let weather_dir = server.join("Weathers");
    fs::create_dir_all(&env_dir)?;
    fs::create_dir_all(&weather_dir)?;

    let weather = default_weather_doc(weather_id);
    fs::write(
        weather_dir.join(format!("{weather_id}.json")),
        serde_json::to_string_pretty(&weather)?,
    )?;

    let env = json!({
        "$Comment": format!("Default environment created by TerraNova for {env_id}"),
        "WeatherForecasts": [
            { "Hour": 0, "Weather": weather_id }
        ],
        "Tags": [],
        "WaterTint": "#4a90d9",
        "SpawnDensity": 1.0
    });
    fs::write(
        env_dir.join(format!("{env_id}.json")),
        serde_json::to_string_pretty(&env)?,
    )?;
    Ok(())
}

fn default_weather_doc(weather_id: &str) -> Value {
    json!({
        "$Comment": format!("Default weather created by TerraNova for {weather_id}"),
        "SkyTopColors": [
            { "Hour": 0, "Color": "rgba(#0a1628, 1.0)" },
            { "Hour": 6, "Color": "rgba(#1e3a5f, 1.0)" },
            { "Hour": 8, "Color": "rgba(#4a90d9, 1.0)" },
            { "Hour": 12, "Color": "rgba(#5ba3e8, 1.0)" },
            { "Hour": 18, "Color": "rgba(#e07b39, 1.0)" },
            { "Hour": 20, "Color": "rgba(#1a2a4a, 1.0)" },
            { "Hour": 23, "Color": "rgba(#0a1628, 1.0)" }
        ],
        "SkyBottomColors": [
            { "Hour": 0, "Color": "rgba(#050d1a, 1.0)" },
            { "Hour": 6, "Color": "rgba(#122540, 1.0)" },
            { "Hour": 8, "Color": "rgba(#2d6aa0, 1.0)" },
            { "Hour": 12, "Color": "rgba(#3a7fc1, 1.0)" },
            { "Hour": 18, "Color": "rgba(#c0582a, 1.0)" },
            { "Hour": 20, "Color": "rgba(#0f1e35, 1.0)" },
            { "Hour": 23, "Color": "rgba(#050d1a, 1.0)" }
        ],
        "FogColors": [
            { "Hour": 0, "Color": "rgba(#0d1f33, 1.0)" },
            { "Hour": 8, "Color": "rgba(#7ab0d4, 0.6)" },
            { "Hour": 12, "Color": "rgba(#a8cce0, 0.4)" },
            { "Hour": 20, "Color": "rgba(#1a2e45, 0.7)" },
            { "Hour": 23, "Color": "rgba(#0d1f33, 1.0)" }
        ],
        "FogDistance": [64, 512]
    })
}

fn try_import_atmosphere(
    server: &Path,
    environment_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let env_rel = format!("Server/Environments/{environment_id}.json");
    let env_src = hytale_assets::resolve_hytale_asset_path(&env_rel)?;
    let env_dir = server.join("Environments");
    fs::create_dir_all(&env_dir)?;
    let env_dest = env_dir.join(format!("{environment_id}.json"));
    fs::copy(&env_src, &env_dest)?;

    let raw = fs::read_to_string(&env_dest)?;
    let doc: Value = serde_json::from_str(&raw)?;
    let weather_id = doc
        .get("WeatherForecasts")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|e| e.get("Weather"))
        .and_then(|w| w.as_str())
        .ok_or("Environment has no WeatherForecasts")?;

    let weather_rel = format!("Server/Weathers/{weather_id}.json");
    let weather_src = hytale_assets::resolve_hytale_asset_path(&weather_rel)?;
    let weather_dir = server.join("Weathers");
    fs::create_dir_all(&weather_dir)?;
    fs::copy(&weather_src, weather_dir.join(format!("{weather_id}.json")))?;
    Ok(())
}

fn build_instance_doc(game_mode: &str) -> Value {
    let mode = if game_mode.trim().is_empty() {
        "Creative"
    } else {
        game_mode.trim()
    };
    json!({
        "$Comment": "Instance created by TerraNova Create Pack wizard",
        "RequiredPlugins": {},
        "ChunkStorage": { "Type": "Hytale" },
        "GameMode": mode,
        "IsPvpEnabled": false,
        "IsSpawningNPC": true,
        "GameTime": "0001-01-01T07:00:00Z",
        "UUID": {
            "$binary": "AZKxiVAMQfWIS0qBsBfjzQ==",
            "$type": "04"
        },
        "GameplayConfig": "Default",
        "IsCompassUpdating": true,
        "IsTicking": true,
        "IsGameTimePaused": false,
        "IsObjectiveMarkersEnabled": true,
        "IsAllNPCFrozen": false,
        "IsSavingPlayers": true,
        "WorldGen": {
            "Type": "HytaleGenerator",
            "WorldStructure": "MainWorld"
        },
        "IsSpawnMarkersEnabled": true,
        "DeleteOnRemove": false,
        "Version": 2
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_identifier_strips_invalid_chars() {
        assert_eq!(slugify_identifier("My Biome"), "My_Biome");
        assert_eq!(slugify_identifier("123bad"), "Biome_123bad");
    }

    #[test]
    fn create_pack_wizard_scaffolds_full_tree_in_tempdir() {
        let base = std::env::temp_dir().join(format!(
            "tn-pack-wizard-scaffold-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0),
        ));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("temp dir");

        let config = PackWizardConfig {
            target_path: base.to_string_lossy().to_string(),
            pack_group: "User".to_string(),
            pack_name: "TestPack".to_string(),
            world_structure_template: "basic".to_string(),
            biome_name: "TestBiome".to_string(),
            biome_template: "basic".to_string(),
            include_starter_props: false,
            starter_prefab_path: Some("props/trees/oak_large".to_string()),
            primary_material_block_id: Some("Rock_Stone".to_string()),
            atmosphere_mode: "custom".to_string(),
            atmosphere_import_id: None,
            instance_name: "TestInstance".to_string(),
            game_mode: "Creative".to_string(),
        };

        let result = create_pack_wizard(config, None).expect("wizard should succeed");
        assert!(Path::new(&result.biome_file_path).is_file());
        assert!(!result.atmosphere_import_fallback);
        assert!(base.join("manifest.json").is_file());
        assert!(base
            .join("Server/HytaleGenerator/Settings/Settings.json")
            .is_file());
        assert!(base
            .join("Server/HytaleGenerator/WorldStructures/MainWorld.json")
            .is_file());
        assert!(base
            .join("Server/HytaleGenerator/Biomes/TestBiome.json")
            .is_file());
        assert!(base
            .join("Server/Environments/Env_TestBiome.json")
            .is_file());
        assert!(base
            .join("Server/Weathers/Weather_TestBiome.json")
            .is_file());
        assert!(result.environment_file_path.is_some());
        assert!(result.weather_file_path.is_some());
        assert!(base
            .join("Server/Instances/TestInstance/instance.bson")
            .is_file());

        let manifest_raw = fs::read_to_string(base.join("manifest.json")).unwrap();
        let manifest: Value = serde_json::from_str(&manifest_raw).unwrap();
        assert_eq!(manifest["hytaleGroup"], "User");
        assert_eq!(manifest["hytaleName"], "TestPack");

        let biome_raw =
            fs::read_to_string(base.join("Server/HytaleGenerator/Biomes/TestBiome.json")).unwrap();
        let biome: Value = serde_json::from_str(&biome_raw).unwrap();
        assert_eq!(biome["MaterialProvider"]["Material"], "Rock_Stone");
        assert_eq!(
            biome["Props"][0]["Assignments"]["Prop"]["Path"],
            "props/trees/oak_large"
        );

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn patch_world_structure_updates_biome_refs() {
        let world = basic_world_structure();
        let patched = patch_world_structure_biome_refs(world, "TestBiome");
        assert_eq!(patched["DefaultBiome"], "TestBiome");
        assert_eq!(patched["Biomes"][0]["Biome"], "TestBiome");
    }
}
