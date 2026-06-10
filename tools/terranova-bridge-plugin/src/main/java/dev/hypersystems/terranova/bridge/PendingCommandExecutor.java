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

    interface Listener {
        void info(String message);

        void warn(String message, @Nullable Throwable error);
    }

    private final Listener listener;
    private long fileOffset;

    PendingCommandExecutor(Listener listener) {
        this.listener = listener;
    }

    void tick(@Nullable Path saveRoot) {
        if (saveRoot == null) {
            return;
        }
        Path pending = saveRoot.resolve("bridge").resolve("pending-commands.log");
        if (!Files.isRegularFile(pending)) {
            fileOffset = 0;
            return;
        }
        try {
            byte[] all = Files.readAllBytes(pending);
            if (fileOffset > all.length) {
                fileOffset = 0;
            }
            if (all.length <= fileOffset) {
                return;
            }
            String chunk =
                    new String(all, (int) fileOffset, all.length - (int) fileOffset, StandardCharsets.UTF_8);
            fileOffset = all.length;
            List<String> lines = parseLines(chunk);
            int ran = 0;
            for (String line : lines) {
                if (ran >= MAX_COMMANDS_PER_TICK) {
                    listener.info(
                            "Throttled pending commands; "
                                    + (lines.size() - ran)
                                    + " deferred to next tick");
                    break;
                }
                if (runLine(saveRoot, line)) {
                    ran++;
                }
            }
        } catch (IOException e) {
            listener.warn("Failed reading pending commands", e);
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

    private boolean runLine(Path saveRoot, String line) {
        String command = line.startsWith("/") ? line.substring(1) : line;
        if (command.isBlank()) {
            return false;
        }
        try {
            CommandManager.get().handleCommand(ConsoleSender.INSTANCE, command);
            appendResultLog(saveRoot, "OK " + line);
            listener.info("Ran: " + line);
            return true;
        } catch (Exception e) {
            appendResultLog(saveRoot, "ERR " + line + " :: " + e.getMessage());
            listener.warn("Command failed: " + line, e);
            return false;
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
