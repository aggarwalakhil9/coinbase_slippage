# Computing Slippage Challenge
## Introduction
This is a node.js based web application to calculate slippage for coinbase. 
``index.js`` is the starting point of the application, which instantiates an ``Express`` application.

## Installation

### Requirements
1. Node.JS (version > 8.x. Developer testing on version > 10.x but should be backward compatible)
2. npm (version > 6.x, but should be backward compatible)

### Procedure
1. ```npm install```
2. Run the dev server ```npm start```

## Implementation details
Implementation details and logic is incorporated as part of code comments alongwith the code.

## Improvements
Current implementation keeps the stream of data in memory and does all the computation in RAM in a standalone machine. In case streaming data increases huge in volume, RAM on a single server will no longer be sufficient to do computations. We would need to have a distributed system with event driven application. 
All events can be put in a clustered RabbitMQ queues with processing services consuming events and doing processing individually. This will help scaling horizontally in case of huge volumes, rather than having bigger RAM on a single server. Multiple instances of application server can be running simultaneously to consume from the RabbitMQ queues.