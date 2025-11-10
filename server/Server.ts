// server/src/index.ts
import express from "express"    
import http from "http"    
import { Server as IOServer, Socket } from "socket.io"    
import path from "path"    

const HTTP_PORT = process.env.PORT || 5000

type PlayerInfo = {
    id: string    
    name?: string    
    socket: Socket    
}    

class Lobby {
    queue: PlayerInfo[] = []    
    add(player: PlayerInfo) {
        this.queue.push(player)    
        this.maybeStartMatch()    
    }
    remove(socketId: string) {
        this.queue = this.queue.filter(p => p.id !== socketId)    
    }
    maybeStartMatch() {
        if (this.queue.length >= 4) {
            const players = this.queue.splice(0, 4)    
            startMatch(players)    
        }
    }
}

const lobby = new Lobby()    

function startMatch(players: PlayerInfo[]) {
    const matchId = `match-${Date.now()}`    
    const payload = {
        matchId,
        players: players.map((p, idx) => ({ id: p.id, name: p.name || `Player${idx + 1}`, index: idx }))
    }    
    players.forEach(p => p.socket.join(matchId))    
    players.forEach(p => p.socket.emit("match_start", payload))    
    console.log("Started match:", matchId, "players:", payload.players.map(x => x.id))    
    // Later: create Match instance for game loop and simulation.
}

const app = express()    
const server = http.createServer(app)    
const io = new IOServer(server, { cors: { origin: "*" } })    

// Serve built client files (assume Vite build output in ../client/dist)
app.set('port', HTTP_PORT)
app.use(express.static(path.join(__dirname, "../dist")))     // adjust path

io.on("connection", (socket) => {
    console.log("Socket connected: ", socket.id)    

    socket.on("join_lobby", (data: { name?: string }) => {
        console.log("join_lobby", socket.id, data)    
        lobby.add({ id: socket.id, name: data?.name, socket })    
        io.emit("lobby_count", { count: lobby.queue.length })    
    })    

    socket.on("leave_lobby", () => {
        lobby.remove(socket.id)    
        io.emit("lobby_count", { count: lobby.queue.length })    
    })    

    socket.on("disconnect", () => {
        console.log("disconnect", socket.id)    
        lobby.remove(socket.id)    
        io.emit("lobby_count", { count: lobby.queue.length })    
    })    
})    

const PORT = Number(process.env.PORT || 3000)    
server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`)    
})    
