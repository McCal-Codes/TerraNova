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

    private ActiveSaveResolver() {}

    @Nullable
    static Path resolve() {
        Path pointer = pointerFile();
        if (pointer != null && Files.isRegularFile(pointer)) {
            try {
                String raw = Files.readString(pointer, StandardCharsets.UTF_8).trim();
                if (!raw.isEmpty()) {
                    Path save = Paths.get(raw);
                    if (Files.isDirectory(save)) {
                        return save;
                    }
                }
            } catch (IOException ignored) {
                // fall through
            }
        }
        return newestActiveSave().orElse(null);
    }

    @Nullable
    private static Path pointerFile() {
        String appdata = System.getenv("APPDATA");
        if (appdata == null || appdata.isBlank()) {
            String home = System.getProperty("user.home");
            if (home == null || home.isBlank()) {
                return null;
            }
            return Paths.get(home, ".local", "share", "Hytale", "UserData", "bridge-active-save.txt");
        }
        return Paths.get(appdata, "Hytale", "UserData", "bridge-active-save.txt");
    }

    private static Optional<Path> newestActiveSave() {
        Path savesRoot = savesRoot();
        if (savesRoot == null || !Files.isDirectory(savesRoot)) {
            return Optional.empty();
        }
        try (Stream<Path> entries = Files.list(savesRoot)) {
            return entries
                    .filter(Files::isDirectory)
                    .filter(ActiveSaveResolver::looksActive)
                    .max(Comparator.comparingLong(ActiveSaveResolver::activityScore));
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    @Nullable
    private static Path savesRoot() {
        String appdata = System.getenv("APPDATA");
        if (appdata != null && !appdata.isBlank()) {
            return Paths.get(appdata, "Hytale", "UserData", "Saves");
        }
        String home = System.getProperty("user.home");
        if (home == null || home.isBlank()) {
            return null;
        }
        return Paths.get(home, ".local", "share", "Hytale", "UserData", "Saves");
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
                score = Math.max(
                        score,
                        logs.filter(p -> p.getFileName().toString().endsWith("_server.log"))
                                .mapToLong(
                                        p -> {
                                            try {
                                                return Files.getLastModifiedTime(p).toMillis();
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
