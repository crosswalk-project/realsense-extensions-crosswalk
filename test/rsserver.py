#!/usr/bin/env python
#
# Copyright (c) 2016 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Simple HTTP Server.

This server builds on SimpleHTTPServer by additionally implementing a POST
request ONLY accepting JSON data like

{
  "message": null,
  "stack": null,
  "status": 0,
  "test": "http://w3c-test.org/battery-status/battery-promise.html",
  "tests": [
    {
      "message": null,
      "name": "navigator.getBattery() return BatteryManager",
      "stack": null,
      "status": 0
    },
    {
      "message": null,
      "name": "navigator.getBattery() shall always return the same promise",
      "stack": null,
      "status": 0
    }
  ]
}

"""

import json
import os
import SimpleHTTPServer
import SocketServer
import threading

from time import sleep as _sleep

_keep_running = True

class RSRequestHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def end_headers(self):
        """Specify no-cache option from command line directly"""
        self.send_my_headers()
        SimpleHTTPServer.SimpleHTTPRequestHandler.end_headers(self)

    def send_my_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def do_POST(self):
        """Serve a POST request."""
        try:
            length = int(self.headers.getheader("content-length"))
            data = self.rfile.read(length)
            json_data = json.loads(data)
            for t in json_data["tests"]:
                if t["status"] == 0:
                    print "PASS ", t["name"]
                elif t["status"] == 1:
                    print "FAIL ", t["name"], " ", t["message"]
                elif t["status"] == 2:
                    print "TIMEOUT ", t["name"], " ", t["message"]
                else:
                    print "NOTRUN ", t["name"], " ", t["message"]
            if json_data["status"] == 0:
                print "OK ", json_data["test"]
            elif json_data["status"] == 2:
                print "TIMEOUT ", json_data["test"], " ", json_data["message"]
            else:
                print "ERROR ", json_data["test"], " ", json_data["message"]
            self.send_response(200)
            self.end_headers()
            global _keep_running
            _keep_running = False
        except Exception:
            self.send_error(415, "Unsupported media type")
        else:
            self.send_error(400, "Bad request")


class RSServer(threading.Thread):
    def __init__(self, port):
        self.port = int(port)
        threading.Thread.__init__(self)
        self.is_shutdown = False
        HandlerClass = RSRequestHandler
        ServerClass = SocketServer.TCPServer
        self.httpd = ServerClass(("", self.port), HandlerClass)

    def run(self):
        print "Serving at port ", self.port
        self.httpd.serve_forever()

    def shutdown(self):
        print "Shutting down server ..."
        self.httpd.shutdown()
        self.httpd.socket.close()
        self.is_shutdown = True


def main():
    server = RSServer(8000)
    server.start()
    while True:
        if not _keep_running:
            server.shutdown()
            break
        _sleep(0.1)
    return


if __name__ == "__main__":
    main()
