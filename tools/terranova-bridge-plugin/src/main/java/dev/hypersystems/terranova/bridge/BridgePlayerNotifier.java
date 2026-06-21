package dev.hypersystems.terranova.bridge;

import com.hypixel.hytale.server.core.Message;
import com.hypixel.hytale.server.core.universe.PlayerRef;
import com.hypixel.hytale.server.core.universe.Universe;
import com.hypixel.hytale.server.core.universe.world.World;
import java.util.function.Consumer;
import javax.annotation.Nullable;

/** Throttled in-game chat notifications for queued Bridge command results. */
final class BridgePlayerNotifier {

    private static final long THROTTLE_MS = 2500L;
    private static final int MAX_LINE_LEN = 72;

    private final Consumer<String> warn;
    private long lastChatAtMs;
    @Nullable private String lastMessage;

    BridgePlayerNotifier(Consumer<String> warn) {
        this.warn = warn;
    }

    void onTickResult(PendingCommandExecutor.TickResult result) {
        String message = buildTickMessage(result);
        if (message != null) {
            sendIfAllowed(message);
        }
    }

    @Nullable
    static String buildTickMessage(PendingCommandExecutor.TickResult result) {
        if (result.isIdle()) {
            return null;
        }
        if (result.failed() > 0 && result.lastFailure() != null) {
            return BridgeMessages.chat("Command failed: " + shorten(result.lastFailure()));
        }
        if (result.succeeded() > 0) {
            String base =
                    result.succeeded() == 1 && result.lastSuccess() != null
                            ? "Ran " + shorten(result.lastSuccess())
                            : "Ran " + result.succeeded() + " queued command(s)";
            if (result.deferred() > 0) {
                base += " (" + result.deferred() + " more queued)";
            }
            return BridgeMessages.chat(base);
        }
        if (result.deferred() > 0) {
            return BridgeMessages.chat(
                    result.deferred() + " command(s) queued; running next tick.");
        }
        return null;
    }

    synchronized void sendIfAllowed(String message) {
        long now = System.currentTimeMillis();
        if (message.equals(lastMessage) && now - lastChatAtMs < THROTTLE_MS) {
            return;
        }
        lastChatAtMs = now;
        lastMessage = message;
        dispatch(message);
    }

    private void dispatch(String message) {
        try {
            Universe universe = Universe.get();
            if (universe == null || universe.getPlayerCount() == 0) {
                return;
            }
            Message chat = Message.raw(message);
            Runnable task =
                    () -> {
                        for (PlayerRef player : universe.getPlayers()) {
                            if (player != null && player.isValid()) {
                                player.sendMessage(chat);
                            }
                        }
                    };
            World world = universe.getDefaultWorld();
            if (world != null) {
                world.execute(task);
            } else {
                task.run();
            }
        } catch (Exception e) {
            warn.accept("Could not send Bridge chat notification: " + e.getMessage());
        }
    }

    private static String shorten(String line) {
        String trimmed = line.trim();
        if (trimmed.length() <= MAX_LINE_LEN) {
            return trimmed;
        }
        return trimmed.substring(0, MAX_LINE_LEN - 3) + "...";
    }
}
