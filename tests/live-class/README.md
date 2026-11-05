# Live class browser test

`e2e.cjs` runs the built React live classroom in Chromium against a small mock server that follows the
same WebSocket protocol as `LiveSocket.java`. It checks: the waiting room, teacher admit, student mic and
camera (real tracks, synced to the teacher's roster), teacher disconnect, teacher ends the class, the
"class ended" screen, and that a student cannot rejoin an ended class.

It does NOT test the Spring backend. Run the real server and two browser accounts for that.

Run (needs `ws` and `playwright` installed, and Chromium at /opt/pw-browsers/chromium or edit the path):

    node tests/live-class/e2e.cjs src/main/resources/static
