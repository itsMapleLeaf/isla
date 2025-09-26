@file:OptIn(ExperimentalUuidApi::class)

package dev.mapleleaf


import io.ktor.client.*
import io.ktor.client.plugins.websocket.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.server.websocket.WebSockets
import io.ktor.websocket.*
import kotlinx.coroutines.channels.consumeEach
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.system.exitProcess
import kotlin.time.DurationUnit
import kotlin.time.toDuration
import kotlin.uuid.ExperimentalUuidApi


class Requirement(
    val item: String,
)

class Item(
    val name: String,
)

class Task(
    val name: String,
    val requirement: Requirement,
    val items: MutableList<String> = mutableListOf(),
)

class World(
    val name: String,
    val victoryCondition: Requirement,
    val tasks: Map<String, Task> = mapOf(),
    val inventory: MutableList<String> = mutableListOf(),
) {
    fun getCompletableTasks(): List<Task> {
        return tasks.values.filter { it.items.isNotEmpty() and isRequirementSatisfied(it.requirement) }
    }

    fun isRequirementSatisfied(requirement: Requirement): Boolean {
        return inventory.any { it == requirement.item }
    }
}

class MultiWorld {
    val worlds = mutableMapOf<String, World>()

    fun complete(worldName: String, taskName: String) {
        val world = worlds[worldName] ?: return
        val task = world.tasks[taskName] ?: return
        world.inventory.addAll(task.items)
        task.items.clear()
    }

    suspend fun handleClientMessage(message: ClientMessage, outgoing: DefaultWebSocketSession) {
        when (message) {
            is ClientMessage.Status -> {
                println("Handle status")
                sendStatus(outgoing, message.world)
            }
            is ClientMessage.Complete -> {
                println("Handle complete")
                complete(message.world, message.task)
                sendStatus(outgoing, message.world)
            }
        }
    }

    private suspend fun sendStatus(outgoing: DefaultWebSocketSession, worldName: String) {
        val world = worlds[worldName] ?: return
        outgoing.send(
            ServerMessage.Status(
                world = worldName,
                inventory = world.inventory,
                completableTasks = world.getCompletableTasks().map { it.name },
                victory = world.isRequirementSatisfied(world.victoryCondition)
            )
        )
    }

    private suspend fun DefaultWebSocketSession.send(message: ServerMessage) {
        println("Sending $message")
        send(Frame.Text(JSON.encodeToString(ServerMessage.serializer(), message)))
        println("Sent $message")
    }
}

@Serializable
sealed class ClientMessage {
    @Serializable
    @SerialName("status")
    data class Status(
        val world: String,
    ) : ClientMessage()

    @Serializable
    @SerialName("visit")
    data class Complete(
        val world: String,
        val task: String,
    ) : ClientMessage()
}

@Serializable
sealed class ServerMessage {
    @Serializable
    @SerialName("status")
    data class Status(
        val world: String,
        val inventory: List<String>,
        val completableTasks: List<String>,
        val victory: Boolean,
    ) : ServerMessage()
}


val JSON = Json {
    classDiscriminator = "type"
}

fun runServer() {
    val multiworld = MultiWorld().apply {
        worlds["SDVX"] = World(
            name = "SDVX",
            inventory = mutableListOf("Blastix Riotz"),
            tasks = mapOf(
                "Blastix Riotz" to Task(
                    name = "Blastix Riotz",
                    requirement = Requirement("Blastix Riotz"),
                    items = mutableListOf("Chronomia"),
                ),
                "Chronomia" to Task(
                    name = "Chronomia",
                    requirement = Requirement("Chronomia"),
                    items = mutableListOf("AIR"),
                ),
                "AIR" to Task(
                    name = "AIR",
                    requirement = Requirement("AIR"),
                    items = mutableListOf("PERFECT ULTIMATE CHAIN"),
                ),
            ),
            victoryCondition = Requirement(item = "PERFECT ULTIMATE CHAIN"),
        )
    }

    val port = 8080

    println("Running server on ws://localhost:$port")

    embeddedServer(Netty, port = port) {
        install(WebSockets) {
            pingPeriod = 15.toDuration(DurationUnit.SECONDS)
            timeout = 30.toDuration(DurationUnit.SECONDS)
            maxFrameSize = Long.MAX_VALUE
            masking = false
        }

        routing {
            webSocket("/") {
                println("New connection")
                incoming.consumeEach { frame ->
                    when (frame) {
                        is Frame.Text -> {
                            val message = JSON.decodeFromString(ClientMessage.serializer(), frame.readText())
                            println("Client message: $message")
                            multiworld.handleClientMessage(message, this)
                        }

                        is Frame.Close -> {
                        }

                        else -> {
                        }
                    }
                }
            }
        }
    }.start(wait = true)
}

data class ClientOption(
    val name: String,
    val action: suspend () -> Unit,
)

suspend inline fun <reified T : ClientMessage> DefaultWebSocketSession.send(message: T) {
    send(Frame.Text(JSON.encodeToString(ClientMessage.serializer(), message)))
}

fun runClient() {
    val client = HttpClient {
//        install(Logging) {
//            logger = io.ktor.client.plugins.logging.Logger.DEFAULT
//            level = LogLevel.HEADERS
//        }
        install(io.ktor.client.plugins.websocket.WebSockets) {
            pingIntervalMillis = 20_000
        }
    }

    runBlocking {
        client.webSocket(
            host = "127.0.0.1",
            port = 8080,
            path = "/",
        ) {
            send<ClientMessage.Status>(ClientMessage.Status("SDVX"))

            var inventory = listOf<String>()
            var tasks = listOf<String>()

            while (true) {
                val data = incoming.receive() as? Frame.Text ?: continue
                val message = JSON.decodeFromString(ServerMessage.serializer(), data.readText())
                when (message) {
                    is ServerMessage.Status -> {
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

                val options = mutableListOf<ClientOption>()

                for (task in tasks) {
                    options.add(ClientOption(task) {
                        send<ClientMessage.Complete>(ClientMessage.Complete("SDVX", task))
                    })
                }

                options.add(ClientOption("Exit") {
                    exitProcess(0)
                })

                for ((index, option) in options.withIndex()) {
                    println("${index + 1}. ${option.name}")
                }
                println("")

                print("> ")

                var option: ClientOption? = null
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

fun main(args: Array<String>) {
    when (args[0]) {
        "client" -> runClient()
        "server" -> runServer()
        else -> error("expected \"client\" or \"server\"")
    }
}
