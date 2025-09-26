package dev.mapleleaf

import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.routing.routing
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import io.ktor.server.websocket.timeout
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.DefaultWebSocketSession
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.channels.consumeEach
import kotlin.time.DurationUnit
import kotlin.time.toDuration

object Server {
    private class Requirement(
        val item: String,
    )

    private class Item(
        val name: String,
    )

    private class Task(
        val name: String,
        val requirement: Requirement,
        val items: MutableList<String> = mutableListOf(),
    )

    private class World(
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

    private class MultiWorld {
        val worlds = mutableMapOf<String, World>()

        fun complete(worldName: String, taskName: String) {
            val world = worlds[worldName] ?: return
            val task = world.tasks[taskName] ?: return
            world.inventory.addAll(task.items)
            task.items.clear()
        }

        suspend fun handleClientMessage(message: NetworkCommon.ClientMessage, outgoing: DefaultWebSocketSession) {
            when (message) {
                is NetworkCommon.ClientMessage.Status -> {
                    println("Handle status")
                    sendStatus(outgoing, message.world)
                }

                is NetworkCommon.ClientMessage.Complete -> {
                    println("Handle complete")
                    complete(message.world, message.task)
                    sendStatus(outgoing, message.world)
                }
            }
        }

        private suspend fun sendStatus(outgoing: DefaultWebSocketSession, worldName: String) {
            val world = worlds[worldName] ?: return
            outgoing.send(
                NetworkCommon.ServerMessage.Status(
                    world = worldName,
                    inventory = world.inventory,
                    completableTasks = world.getCompletableTasks().map { it.name },
                    victory = world.isRequirementSatisfied(world.victoryCondition)
                )
            )
        }

        private suspend fun DefaultWebSocketSession.send(message: NetworkCommon.ServerMessage) {
            println("Sending $message")
            send(Frame.Text(NetworkCommon.json.encodeToString(NetworkCommon.ServerMessage.serializer(), message)))
            println("Sent $message")
        }
    }

    fun start() {
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
            install(WebSockets.Plugin) {
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
                                val message = NetworkCommon.json.decodeFromString(
                                    NetworkCommon.ClientMessage.serializer(),
                                    frame.readText()
                                )
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
}