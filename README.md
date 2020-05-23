webchat
=======

The goal is to develop a simple, secure, light-weight and easy to use open
source video chat application. The application should work in any modern
browser without requiring installation of extra plugins. Hosting the
application should only require minimal resources.

<https://arthurdejong.org/webchat/>


Security
--------

The application provides end-to-end confidentiality of all communications
between users. The server hosting the application does not have access to the
contents of the communication.

Video and audio communication use WebRTC with peer-to-peer connections
between the browsers (optionally through a TURN server). More details on the
security of WebRTC can be found at <https://webrtc-security.github.io/>

Other communication (text chat and some of the WebRTC signalling messages)
are encrypted in Javascript before being relayed through the server to the
other participants.

Users that participate in a chat share an encryption key that is never sent
to the server. Users can share the encryption key via a URL that can be
shared in whatever way the users deem appropriate.

Currently it does not provide:
- privacy of IP addresses of participants (the IP address will be used in
  communication with the server and in WebRTC between the browsers)
- full anonymity (on the server it is possible to deduce the number of active
  meetings and number of participants per meeting)
- mutual authentication (it is assumed that users only share the encryption
  key in a secure manner with trusted participants)


Self-hosted
-----------

The application is released under the GNU General Public License and can be
easily deployed on any server that supports websockets. On the server a
simple Python application provides message relaying. Other than that only
static files need to be served.

Installation
------------

Build the static HTML, Javascript and CSS files to the `static` directory:

    npm install
    npm run build

Optionally an `RTCConfiguration.json` file with extra ICE options can be put
in the same directory.

The Python 3 application can be run with (likely create a virtualenv first):

    pip install aiohttp
    python3 channel.py

An example systemd service file to start the application:

    [Unit]
    Description=Simple chat daemon

    [Service]
    Type=simple
    WorkingDirectory=/opt/webchat
    ExecStart=/opt/webchat/venv/bin/python3 /opt/webchat/channel.py
    Restart=on-failure
    User=webchat
    Group=webchat

    [Install]
    WantedBy=multi-user.target

A web server that serves HTTPS is assumed to be available. It should be
configured to serve the static files and forward the handling of the websocket
connections to the Python application.

An example Apache config snippet (requires the proxy_wstunnel module):

    Alias /webchat /opt/webchat/static
    ProxyPass /webchat/channel ws://localhost:8080/channel
    <Directory /opt/webchat/static>
      Require all granted
      Header always set Content-Security-Policy "default-src 'none';style-src 'self' 'unsafe-inline';img-src 'self';media-src 'self';script-src 'self';connect-src 'self';frame-ancestors 'none';form-action 'self';base-uri 'self'"
    </Directory>

Copyright
---------

Copyright (C) 2020 Arthur de Jong and others

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
