package com.tomodachi.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class TomodachiBackendApplication

fun main(args: Array<String>) {
    runApplication<TomodachiBackendApplication>(*args)
}
