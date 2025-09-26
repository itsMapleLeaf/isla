package dev.mapleleaf

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

object NetworkCommon {
    val json = Json {
        classDiscriminator = "type"
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
}