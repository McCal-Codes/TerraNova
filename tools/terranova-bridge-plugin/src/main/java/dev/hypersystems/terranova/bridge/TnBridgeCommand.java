package dev.hypersystems.terranova.bridge;

import com.hypixel.hytale.server.core.Message;
import com.hypixel.hytale.server.core.command.system.CommandContext;
import com.hypixel.hytale.server.core.command.system.basecommands.AbstractCommandCollection;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;

/** /tnbridge command group for TerraNova Bridge diagnostics and control. */
public final class TnBridgeCommand extends AbstractCommandCollection {

    public TnBridgeCommand(BridgeServices services) {
        super("tnbridge", "TerraNova Bridge diagnostics and control");
        addAliases("tnb");
        addSubCommand(new StatusSubCommand(services));
        addSubCommand(new SaveSubCommand());
        addSubCommand(new PauseSubCommand(services));
        addSubCommand(new ResumeSubCommand(services));
        addSubCommand(new DoctorSubCommand(services.runtime));
        addSubCommand(new NotifyCommandCollection(services));
    }

    @Override
    protected boolean canGeneratePermission() {
        return false;
    }

    private abstract static class TnBridgeSubCommand
            extends com.hypixel.hytale.server.core.command.system.AbstractCommand {
        protected TnBridgeSubCommand(String name, String description) {
            super(name, description);
        }

        @Override
        protected boolean canGeneratePermission() {
            return false;
        }

        protected void send(CommandContext context, String text) {
            context.sender().sendMessage(Message.raw(text));
        }

        protected void sendConsole(CommandContext context, String body) {
            send(context, BridgeMessages.console(body));
        }
    }

    private static final class StatusSubCommand extends TnBridgeSubCommand {
        private final BridgeServices services;

        StatusSubCommand(BridgeServices services) {
            super("status", "Show polling state, save, and queue size");
            this.services = services;
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            BridgeRuntime runtime = services.runtime;
            ActiveSaveResolver.ResolveResult save = ActiveSaveResolver.resolveDetailed();
            StringBuilder sb = new StringBuilder();
            sb.append(BridgeMessages.console("status")).append('\n');
            sb.append("polling: ").append(runtime.isPolling() ? "active" : "stopped").append('\n');
            sb.append("paused: ").append(runtime.isPaused()).append('\n');
            sb.append("notifications: ")
                    .append(runtime.isNotificationsEnabled() ? "on" : "off")
                    .append('\n');
            if (runtime.lastTickAtMs() > 0) {
                long ageMs = System.currentTimeMillis() - runtime.lastTickAtMs();
                sb.append("last tick: ")
                        .append(formatAge(ageMs))
                        .append(" ago (ran ")
                        .append(runtime.lastCommandsRan())
                        .append(" command(s))\n");
            } else {
                sb.append("last tick: never\n");
            }
            if (save.saveRoot() != null) {
                sb.append("save: ").append(save.saveRoot()).append('\n');
                sb.append("save source: ").append(save.source().label()).append('\n');
                int queued = services.executor.countQueuedCommands(save.saveRoot());
                sb.append("queued commands: ").append(queued).append('\n');
            } else {
                sb.append("save: unresolved\n");
            }
            sb.append("sidecar: ")
                    .append(BridgeDoctor.isSidecarReachable() ? "reachable" : "offline")
                    .append('\n');
            @Nullable String tickError = runtime.lastTickError();
            if (tickError != null && !tickError.isBlank()) {
                sb.append("last error: ").append(tickError);
            }
            send(context, sb.toString().trim());
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class SaveSubCommand extends TnBridgeSubCommand {
        SaveSubCommand() {
            super("save", "Show resolved save root and pointer source");
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            ActiveSaveResolver.ResolveResult save = ActiveSaveResolver.resolveDetailed();
            StringBuilder sb = new StringBuilder();
            sb.append(BridgeMessages.console("save")).append('\n');
            if (save.saveRoot() == null) {
                sb.append("resolved: none\n");
                sb.append("hint: start this world or run TerraNova sidecar for the save.");
            } else {
                sb.append("resolved: ").append(save.saveRoot()).append('\n');
                sb.append("source: ").append(save.source().label());
                if (save.detail() != null && !save.detail().isBlank()) {
                    sb.append('\n').append("detail: ").append(save.detail());
                }
            }
            Path pointer = ActiveSaveResolver.pointerFilePath();
            if (pointer != null) {
                sb.append('\n').append("pointer file: ").append(pointer);
            }
            send(context, sb.toString());
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class PauseSubCommand extends TnBridgeSubCommand {
        private final BridgeServices services;

        PauseSubCommand(BridgeServices services) {
            super("pause", "Pause executing queued bridge commands");
            this.services = services;
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            if (!services.runtime.isPolling()) {
                sendConsole(context, "polling thread is not running.");
                return CompletableFuture.completedFuture(null);
            }
            services.runtime.setPaused(true);
            sendConsole(
                    context,
                    "paused command execution. Queue will keep growing until /tnbridge resume.");
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class ResumeSubCommand extends TnBridgeSubCommand {
        private final BridgeServices services;

        ResumeSubCommand(BridgeServices services) {
            super("resume", "Resume executing queued bridge commands");
            this.services = services;
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            if (!services.runtime.isPolling()) {
                sendConsole(context, "polling thread is not running.");
                return CompletableFuture.completedFuture(null);
            }
            services.runtime.setPaused(false);
            sendConsole(context, "resumed command execution.");
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class DoctorSubCommand extends TnBridgeSubCommand {
        private final BridgeRuntime runtime;

        DoctorSubCommand(BridgeRuntime runtime) {
            super("doctor", "Run TerraNova Bridge health checks");
            this.runtime = runtime;
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            List<BridgeDoctor.Finding> findings = BridgeDoctor.run(runtime);
            StringBuilder sb = new StringBuilder(BridgeMessages.console("doctor")).append('\n');
            for (BridgeDoctor.Finding finding : findings) {
                String prefix =
                        switch (finding.level()) {
                            case OK -> "OK";
                            case WARN -> "WARN";
                            case FAIL -> "FAIL";
                        };
                sb.append(prefix).append(" - ").append(finding.message()).append('\n');
            }
            send(context, sb.toString().trim());
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class NotifyCommandCollection
            extends com.hypixel.hytale.server.core.command.system.basecommands
                    .AbstractCommandCollection {
        NotifyCommandCollection(BridgeServices services) {
            super("notify", "Control in-game chat notifications");
            addSubCommand(new NotifyOnSubCommand(services));
            addSubCommand(new NotifyOffSubCommand(services));
            addSubCommand(new NotifyStatusSubCommand(services));
        }

        @Override
        protected boolean canGeneratePermission() {
            return false;
        }
    }

    private static final class NotifyOnSubCommand extends TnBridgeSubCommand {
        private final BridgeServices services;

        NotifyOnSubCommand(BridgeServices services) {
            super("on", "Enable in-game chat notifications");
            this.services = services;
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            services.setNotificationsEnabled(true);
            sendConsole(context, "in-game notifications enabled.");
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class NotifyOffSubCommand extends TnBridgeSubCommand {
        private final BridgeServices services;

        NotifyOffSubCommand(BridgeServices services) {
            super("off", "Disable in-game chat notifications");
            this.services = services;
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            services.setNotificationsEnabled(false);
            sendConsole(context, "in-game notifications disabled.");
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class NotifyStatusSubCommand extends TnBridgeSubCommand {
        private final BridgeServices services;

        NotifyStatusSubCommand(BridgeServices services) {
            super("status", "Show in-game notification setting");
            this.services = services;
        }

        @Override
        @Nullable
        protected CompletableFuture<Void> execute(@Nonnull CommandContext context) {
            sendConsole(
                    context,
                    "notifications: "
                            + (services.runtime.isNotificationsEnabled() ? "on" : "off"));
            return CompletableFuture.completedFuture(null);
        }
    }

    private static String formatAge(long ageMs) {
        if (ageMs < 1000) {
            return ageMs + "ms";
        }
        Duration duration = Duration.ofMillis(ageMs);
        long seconds = duration.toSeconds();
        if (seconds < 60) {
            return seconds + "s";
        }
        long minutes = duration.toMinutes();
        if (minutes < 60) {
            return minutes + "m";
        }
        return duration.toHours() + "h";
    }
}
