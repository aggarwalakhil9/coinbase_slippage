const express = require('express');
const WebSocket = require('ws');
const SortedMap = require("collections/sorted-map");
const app = express();
const port = 3000;
const uri = 'wss://ws-feed.pro.coinbase.com';
const TRADE_VOLUME = 10;

/**
 * Sorted map is a BST implementation of maps which keeps the keys in sorted order. 
 * insertion is O(log(N)) 
 * fetching and deleting is O(1)
 */
app.listen(port, () => {
    let buyOrderBook = new SortedMap(null, null, null, null, -1);
    let sellOrderBook = new SortedMap();
    let sellChangesBuffer = [];
    let buyChangesBuffer = [];

    console.log('Express server listening on port ' + port);
    const connection = new WebSocket(uri);
    connection.onopen = () => {
        connection.send(JSON.stringify({
            "type": "subscribe",
            "product_ids": [
                "BTC-USD"
            ],
            "channels": [
                "level2"
            ]
        }))
    }

    connection.onmessage = (message) => {
        let data = message.data;
        data = JSON.parse(data);
        if(data.type === 'snapshot'){
            constructSellOrderBook(data.asks);
            constructBuyOrderBook(data.bids);
        }
        else if(data.type === 'l2update'){
            if(data.changes[0][0] == 'sell'){
                sellChangesBuffer.push(data.changes);
            }
            else if(data.changes[0][0] == 'buy'){
                buyChangesBuffer.push(data.changes);
            }
        }
    }

    /**
     * construct buy order book using the bids in the snapshot
     * @param {*} bids array of bid prices
     */    
    let constructBuyOrderBook = (bids) => {
        bids.map((bid) => {
            try{
                let key = parseFloat(bid[0]).toFixed(2);
                let value = parseFloat(bid[1]);
                // ignore orders with 0 size
                if(value){
                    buyOrderBook.set(key, value);
                }
            }
            catch(err){
                console.log("Exception with the data received via websocket", err);
            }
        });        
    }

    /**
     * construct sell order book using the asks in the snapshot
     * @param {*} asks array of ask prices
     */
    let constructSellOrderBook = (asks) => {
        asks.map((ask) => {
            try{
                let key = parseFloat(ask[0]).toFixed(2);
                let value = parseFloat(ask[1]);
                // ignore orders with 0 size
                if(value){
                    sellOrderBook.set(key, value);
                }
            }
            catch(err){
                console.log("Exception with the data received via websocket", err);
            }
        });
    }

    /**
     * update sell order book with new changes
     */
    let updateSellOrderBook = () => {
        sellChangesBuffer.map((change) => {
            try{
                let key = parseFloat(change[0][1]).toFixed(2);
                let value = parseFloat(change[0][2]);
                // remove orders with 0 size - else map will increase in size with time
                if(!value && sellOrderBook.has(key)){
                    sellOrderBook.delete(key);    
                }
                else{
                    sellOrderBook.set(key, value);
                }
            }
            catch(err){
                console.log("Exception with the data received via websocket", err);                
            }
        });        
    }

    /**
     * update buy order book with new changes
     */
    let updateBuyOrderBook = () => {
        buyChangesBuffer.map((change) => {
            try{
                let key = parseFloat(change[0][1]).toFixed(2);
                let value = parseFloat(change[0][2]);
                // remove orders with 0 size - else map will increase in size with time
                if(!value && buyOrderBook.has(key)){
                    buyOrderBook.delete(key);    
                }
                else{
                    buyOrderBook.set(key, value);
                }
            }
            catch(err){
                console.log("Exception with the data received via websocket", err);
            }
        });        
    }

    /**
     * compute price to trade N BTC 
     * @param {*} orderBook copy of orderBook
     * @param {*} buySize trade volume
     */
    let computePrice = (orderBook, buySize) => {
        let totalBuy = buySize;
        let totalPrice = 0;
        for (let key of orderBook.keys()) {
            let size = orderBook.get(key);
            totalPrice += key * Math.min(totalBuy, size);
            totalBuy -= size;       
            if(totalBuy <= 0){
                return totalPrice/buySize;
            }
        }
        return totalPrice;
    }

    /**
     * calculate the slippage as (executedPrice - expectedPrice) * 100 / expectedPrice
     * @param {*} expectedPrice 
     * @param {*} executedPrice 
     * @return slippage value
     */
    let calculateSlippage = (expectedPrice, executedPrice) => {
        let slippage = (executedPrice - expectedPrice) * 100 / expectedPrice
        return isNaN(slippage) ? 0 : slippage;
    }

    /*
    * every 1 second compute expected price of trade between at t_0
    * update order book with new changes => this will be time corresponding to t_0
    * clear changesBuffer
    * compute executed price and slippage for N units
    */   
    setInterval(() => {
        let origSellOrderBook = sellOrderBook.clone();
        updateSellOrderBook();
        sellChangesBuffer = [];
        let expectedPrice = computePrice(origSellOrderBook, TRADE_VOLUME);
        let executedPrice = computePrice(sellOrderBook, TRADE_VOLUME);
        console.log("sell slippage -> ", calculateSlippage(expectedPrice, executedPrice).toFixed(4), '%');
    }, 1000);

    /*
    * every 1 second compute expected price of trade between at t_0
    * update order book with new changes => this will be time corresponding to t_0
    * clear changesBuffer
    * compute executed price and slippage for N units
    */   
    setInterval(() => {
        let origBuyOrderBook = buyOrderBook.clone();
        updateBuyOrderBook();
        buyChangesBuffer = [];
        let expectedPrice = computePrice(origBuyOrderBook, TRADE_VOLUME);
        let executedPrice = computePrice(buyOrderBook, TRADE_VOLUME);
        console.log("buy slippage -> ", calculateSlippage(expectedPrice, executedPrice).toFixed(4), '%');
    }, 1000);
})