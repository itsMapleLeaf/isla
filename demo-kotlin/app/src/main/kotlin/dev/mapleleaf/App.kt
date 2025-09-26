package dev.mapleleaf

fun main(args: Array<String>) {
    when (args[0]) {
        "client" -> Client.start()
        "server" -> Server.start()
        else -> error("expected \"client\" or \"server\"")
    }
}
