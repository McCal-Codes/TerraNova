package dev.hypersystems.terranova.bridge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Stream;
import javax.annotation.Nullable;

/** Resolves which save folder TerraNova Bridge should poll. */
final class ActiveSaveResolver {

    enum SaveSource {
        POINTER("bridge-active-save.txt"),
        NEWEST_ACTIVE("newest active save heuristic"),
        NONE("unresolved");

        private final String label;

        SaveSource(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }
    }

    record ResolveResult(
            @Nullable Path saveRoot, SaveSource source, @Nullable String detail) {}

    private ActiveSaveResolver() {}

    @Nullable
    static Path resolve() {
        ResolveResult result = resolveDetailed();
        return result.saveRoot();
    }

    static ResolveResult resolveDetailed() {
        for (Path userData : userDataRoots()) {
            Path pointer = userData.resolve("bridge-active-save.txt");
            if (!Files.isRegularFile(pointer)) {
                continue;
            }
            try {
                String raw = Files.readString(pointer, StandardCharsets.UTF_8).trim();
                if (!raw.isEmpty()) {
                    Path save = Paths.get(raw);
                    if (Files.isDirectory(save)) {
                        return new ResolveResult(save, SaveSource.POINTER, pointer.toString());
                    }
                    return new ResolveResult(
                            null,
                            SaveSource.NONE,
                            "Pointer file exists but path is not a directory: " + raw);
                }
            } catch (IOException e) {
                return new ResolveResult(
                        null, SaveSource.NONE, "Could not read pointer file: " + e.getMessage());
            }
        }
        Optional<Path> newest = newestActiveSave();
        if (newest.isPresent()) {
            return new ResolveResult(newest.get(), SaveSource.NEWEST_ACTIVE, null);
        }
        return new ResolveResult(null, SaveSource.NONE, null);
    }

    @Nullable
    static Path pointerFilePath() {
        for (Path userData : userDataRoots()) {
            Path pointer = userData.resolve("bridge-active-save.txt");
            if (Files.isRegularFile(pointer)) {
                return pointer;
            }
        }
        return userDataRoots().isEmpty() ? null : userDataRoots().get(0).resolve("bridge-active-save.txt");
    }

    private static java.util.List<Path> userDataRoots() {
        java.util.ArrayList<Path> roots = new java.util.ArrayList<>();
        Path release = releaseUserDataRoot();
        if (release != null) {
            roots.add(release);
        }
        Path preRelease = preReleaseUserDataRoot();
        if (preRelease != null && (release == null || !preRelease.equals(release))) {
            roots.add(preRelease);
        }
        return roots;
    }

    @Nullable
    private static Path hytaleConfigRoot() {
        String appdata = System.getenv("APPDATA");
        if (appdata != null && !appdata.isBlank()) {
            return Paths.get(appdata, "Hytale");
        }
        String home = System.getProperty("user.home");
        if (home == null || home.isBlank()) {
            return null;
        }
        return Paths.get(home, ".local", "share", "Hytale");
    }

    @Nullable
    private static Path releaseUserDataRoot() {
        Path base = hytaleConfigRoot();
        return base == null ? null : base.resolve("UserData");
    }

    @Nullable
    private static Path preReleaseUserDataRoot() {
        Path base = hytaleConfigRoot();
        return base == null ? null : base.resolve("data").resolve("pre-release").resolve("UserData");
    }

    private static Optional<Path> newestActiveSave() {
        Optional<Path> best = Optional.empty();
        long bestScore = 0L;
        for (Path userData : userDataRoots()) {
            Path savesRoot = userData.resolve("Saves");
            if (!Files.isDirectory(savesRoot)) {
                continue;
            }
            try (Stream<Path> entries = Files.list(savesRoot)) {
                Optional<Path> candidate =
                        entries.filter(Files::isDirectory)
                                .filter(ActiveSaveResolver::looksActive)
                                .max(Comparator.comparingLong(ActiveSaveResolver::activityScore));
                if (candidate.isPresent()) {
                    long score = activityScore(candidate.get());
                    if (score >= bestScore) {
                        bestScore = score;
                        best = candidate;
                    }
                }
            } catch (IOException ignored) {
                // try next patchline
            }
        }
        return best;
    }

    private static boolean looksActive(Path saveRoot) {
        Path bridgeDir = saveRoot.resolve("bridge");
        if (!Files.isDirectory(bridgeDir)) {
            return false;
        }
        Path logsDir = saveRoot.resolve("logs");
        if (!Files.isDirectory(logsDir)) {
            return false;
        }
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(logsDir, "*_server.log")) {
            for (Path ignored : stream) {
                return true;
            }
        } catch (IOException e) {
            return false;
        }
        return false;
    }

    private static long activityScore(Path saveRoot) {
        long score = 0;
        Path pending = saveRoot.resolve("bridge").resolve("pending-commands.log");
        if (Files.isRegularFile(pending)) {
            try {
                score = Math.max(score, Files.getLastModifiedTime(pending).toMillis());
            } catch (IOException ignored) {
                // ignore
            }
        }
        Path logsDir = saveRoot.resolve("logs");
        if (Files.isDirectory(logsDir)) {
            try (Stream<Path> logs = Files.list(logsDir)) {
                score =
                        Math.max(
                                score,
                                logs.filter(p -> p.getFileName().toString().endsWith("_server.log"))
                                        .mapToLong(
                                                p -> {
                                                    try {
                                                        return Files.getLastModifiedTime(p)
                                                                .toMillis();
                                                    } catch (IOException e) {
                                                        return 0L;
                                                    }
                                                })
                                        .max()
                                        .orElse(0L));
            } catch (IOException ignored) {
                // ignore
            }
        }
        return score;
    }
}
