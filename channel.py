# Webchat WebRTC application
# https://arthurdejong.org/webchat/
#
# Copyright (C) 2020 Arthur de Jong
#
# Released under the GNU General Public License, either version 3, or
# (at your option) any later version.

"""Simple server that relays channel messages across websockets."""

import asyncio
import collections

import aiohttp
import aiohttp.web


routes = aiohttp.web.RouteTableDef()


websockets = collections.defaultdict(set)


async def send_to_all(channel, data):
    """Send the data to all websockets for the channel."""
    tasks = set(
        asyncio.ensure_future(ws.send_bytes(data))
        for ws in websockets[channel])
    while tasks:
        done, tasks = await asyncio.wait(tasks)


@routes.get('/channel/{channel}')
async def get_channel(request):
    """Process a new connection by returning a websocket."""
    channel = request.match_info['channel']
    ws = aiohttp.web.WebSocketResponse()
    await ws.prepare(request)
    websockets[channel].add(ws)
    try:
        # keep relaying all messages
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.BINARY:
                await send_to_all(channel, msg.data)
    finally:
        websockets[channel].remove(ws)
    return ws


if __name__ == '__main__':
    app = aiohttp.web.Application()
    app.add_routes(routes)
    aiohttp.web.run_app(app, host='localhost')
