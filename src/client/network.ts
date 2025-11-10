import { io, Socket } from "socket.io-client";

export type Network = {
  socket: Socket;
  connect: () => void;
  joinLobby: (name?: string) => void;
  leaveLobby: () => void;
};

export function createNetwork(serverUrl = window.location.origin): Network {
  const socket = io(serverUrl);

  return {
    socket,
    connect: () => { if (!socket.connected) socket.connect(); },
    joinLobby: (name?: string) => socket.emit("join_lobby", { name }),
    leaveLobby: () => socket.emit("leave_lobby")
  };
}
