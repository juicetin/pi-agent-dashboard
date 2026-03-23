## 1. Guard WebSocket operations

- [x] 1.1 Wrap `this.ws.send(data)` in try/catch in `ConnectionManager.send()` — on failure, buffer the message
- [x] 1.2 Wrap `new this.WS(this.url)` in try/catch in `ConnectionManager.createConnection()` — on failure, schedule reconnect
- [x] 1.3 Add test: `send()` buffers message when `ws.send()` throws
- [x] 1.4 Add test: `createConnection()` schedules reconnect when constructor throws
