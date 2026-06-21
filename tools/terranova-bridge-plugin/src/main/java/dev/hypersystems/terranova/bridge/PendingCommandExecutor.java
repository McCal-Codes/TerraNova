package dev.hypersystems.terranova.bridge;

import com.hypixel.hytale.server.core.command.system.CommandManager;
import com.hypixel.hytale.server.core.console.ConsoleSender;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import javax.annotation.Nullable;

/** Tails bridge/pending-commands.log and runs lines via the server console. */
final class PendingCommandExecutor {

    private static final int MAX_COMMANDS_PER_TICK = 8;

    record TickResult(
            int succeeded,
            int failed,
            int deferred,
            @Nullable String lastSuccess,
            @Nullable String lastFailure) {

        static TickResult idle() {
            return new TickResult(0, 0, 0, null, null);
        }

        int ranTotal() {
            return succeeded + failed;
        }

        boolean isIdle() {
            return succeeded == 0 && failed == 0 && deferred == 0;
        }
    }

    interface Listener {
        void info(String message);

        void warn(String message, @Nullable Throwable error);
    }

    private final Listener listener;
    private long fileOffset;

    PendingCommandExecutor(Listener listener) {
        this.listener = listener;
    }

    TickResult tick(@Nullable Path saveRoot, boolean paused) {
        if (saveRoot == null || paused) {
            return TickResult.idle();
        }
        Path pending = saveRoot.resolve("bridge").resolve("pending-commands.log");
        if (!Files.isRegularFile(pending)) {
            fileOffset = 0;
            return TickResult.idle();
        }
        try {
            byte[] all = Files.readAllBytes(pending);
            if (fileOffset > all.length) {
                fileOffset = 0;
            }
            if (all.length <= fileOffset) {
                return TickResult.idle();
            }
            String chunk =
                    new String(all, (int) fileOffset, all.length - (int) fileOffset, StandardCharsets.UTF_8);
            fileOffset = all.length;
            List<String> lines = parseLines(chunk);
            int succeeded = 0;
            int failed = 0;
            @Nullable String lastSuccess = null;
            @Nullable String lastFailure = null;
            int processed = 0;
            for (String line : lines) {
                if (processed >= MAX_COMMANDS_PER_TICK) {
                    break;
                }
                RunOutcome outcome = runLine(saveRoot, line);
                if (outcome == RunOutcome.SUCCEEDED) {
                    succeeded++;
                    lastSuccess = line;
                } else if (outcome == RunOutcome.FAILED) {
                    failed++;
                    lastFailure = line;
                }
                processed++;
            }
            int deferred = Math.max(0, lines.size() - processed);
            if (deferred > 0) {
                listener.info("Throttled pending commands; " + deferred + " deferred to next tick");
            }
            return new TickResult(succeeded, failed, deferred, lastSuccess, lastFailure);
        } catch (IOException e) {
            listener.warn("Failed reading pending commands", e);
            return TickResult.idle();
        }
    }

    int countQueuedCommands(@Nullable Path saveRoot) {
        if (saveRoot == null) {
            return 0;
        }
        Path pending = saveRoot.resolve("bridge").resolve("pending-commands.log");
        return countActionableLines(pending);
    }

    static int countActionableLines(Path pending) {
        if (!Files.isRegularFile(pending)) {
            return 0;
        }
        try {
            return parseLines(Files.readString(pending, StandardCharsets.UTF_8)).size();
        } catch (IOException e) {
            return 0;
        }
    }

    private static List<String> parseLines(String chunk) {
        List<String> out = new ArrayList<>();
        for (String raw : chunk.split("\\R")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            out.add(line);
        }
        return out;
    }

    private enum RunOutcome {
        SKIPPED,
        SUCCEEDED,
        FAILED
    }

    private RunOutcome runLine(Path saveRoot, String line) {
        String command = line.startsWith("/") ? line.substring(1) : line;
        if (command.isBlank()) {
            return RunOutcome.SKIPPED;
        }
        try {
            CommandManager.get().handleCommand(ConsoleSender.INSTANCE, command);
            appendResultLog(saveRoot, "OK " + line);
            listener.info("Ran: " + line);
            return RunOutcome.SUCCEEDED;
        } catch (Exception e) {
            appendResultLog(saveRoot, "ERR " + line + " :: " + e.getMessage());
            listener.warn("Command failed: " + line, e);
            return RunOutcome.FAILED;
        }
    }

    private static void appendResultLog(Path saveRoot, String line) {
        Path result = saveRoot.resolve("bridge").resolve("command-results.log");
        try {
            Files.createDirectories(result.getParent());
            Files.writeString(
                    result,
                    line + System.lineSeparator(),
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);
        } catch (IOException ignored) {
            // best effort
        }
    }
}
