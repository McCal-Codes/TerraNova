package dev.hypersystems.terranova.bridge;

/** Shared TerraNova Bridge user-facing message prefixes. */
final class BridgeMessages {

    static final String CONSOLE_PREFIX = "[TerraNova.Bridge] ";
    static final String CHAT_PREFIX = "[TerraNova] ";

    private BridgeMessages() {}

    static String console(String body) {
        return CONSOLE_PREFIX + body;
    }

    static String chat(String body) {
        return CHAT_PREFIX + body;
    }
}
