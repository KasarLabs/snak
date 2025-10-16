import http from "http";
import fs from "fs";
import path from "path";

http.createServer((req, res) => {
  if (req.url === "/") {
    const indexPath = path.join(process.cwd(), "index.html");
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading frontend");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(8080, () => console.log("✅ Frontend listening on 8080"));
