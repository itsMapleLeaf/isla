package dev.mapleleaf

import io.ktor.client.HttpClient
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.websocket.DefaultWebSocketSession
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.runBlocking
import kotlin.system.exitProcess

object Client {
    private data class Option(
        val name: String,
        val action: suspend () -> Unit,
    )

    private suspend inline fun <reified T : NetworkCommon.ClientMessage> DefaultWebSocketSession.send(message: T) {
        send(Frame.Text(NetworkCommon.json.encodeToString(NetworkCommon.ClientMessage.serializer(), message)))
    }

    fun start() {
        val client = HttpClient {
            install(WebSockets) {
                pingIntervalMillis = 20_000
            }
        }

        runBlocking {
            client.webSocket(
                host = "127.0.0.1",
                port = 8080,
                path = "/",
            ) {
                send<NetworkCommon.ClientMessage.Status>(NetworkCommon.ClientMessage.Status("SDVX"))

                var inventory = listOf<String>()
                var tasks = listOf<String>()

                while (true) {
                    val data = incoming.receive() as? Frame.Text ?: continue
                    val message =
                        NetworkCommon.json.decodeFromString(NetworkCommon.ServerMessage.serializer(), data.readText())
                    when (message) {
                        is NetworkCommon.ServerMessage.Status -> {
                            if (message.victory) {
                                println("You win!")
                                println("")
                            }
                            inventory = message.inventory
                            tasks = message.completableTasks
                        }
                    }

                    println("== Inventory ==")
                    for (item in inventory) {
                        println("- $item")
                    }
                    println("")

                    val options = mutableListOf<Option>()

                    for (task in tasks) {
                        options.add(Option(task) {
                            send<NetworkCommon.ClientMessage.Complete>(
                                NetworkCommon.ClientMessage.Complete(
                                    "SDVX",
                                    task
                                )
                            )
                        })
                    }

                    options.add(Option("Exit") {
                        exitProcess(0)
                    })

                    for ((index, option) in options.withIndex()) {
                        println("${index + 1}. ${option.name}")
                    }
                    println("")

                    print("> ")

                    var option: Option? = null
                    do {
                        val input = readln().toIntOrNull() ?: continue
                        option = options.getOrNull(input - 1)
                    } while (option == null)

                    option.action.invoke()
                }
            }
        }

        client.close()
    }
}