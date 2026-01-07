//Load dependencies
const fs = require("fs");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const crypto = require("crypto");
const commands = require("./commands.js");
const webhooks = [
	"/api/webhooks/1452010527537758288/n_OsFAh-8fTfXfVyZe6wCI9GDRjWqY7FetaeP6ij4TBwYWMAbFdPxv6AruKYn_8itMAv",
	"/api/webhooks/1452363605956886700/WgNPKU_3dUeWtYoNEsBrafJu4nYQCPsW5ul5ZyEUQhTlEPyjZlcSJ9T0QNmuYBKMR4z5",
];
let uptime = 0;
const whitelist = commands.whitelist;
setInterval(() => {
	uptime++;
	Object.keys(rooms).forEach((room) => {
		rooms[room].reg++;
		Object.keys(rooms[room].users).forEach((user) => {
			rooms[room].users[user].public.joined++;
			//rooms[room].emit("update", room[room].users[user].public)
		});
	});
}, 60000);

let blacklist = [
	"a84e8gj49an49fja9wutjwe949",
];
function checkBlacklist(param) {
	bad = false;
	blacklist.forEach((badword) => {
		if (param.toLowerCase().includes(badword.toLowerCase())) bad = true;
	});
	return bad;
}

//Read settings (READER IN COMMANDS LIBRARY)
const config = commands.config;
const colors = commands.colors;
const markup = commands.markup;
const markUpName = commands.markUpName;

commands.vpncache = fs
	.readFileSync("./config/vpncache.txt")
	.toString()
	.split("\n")
	.map((e) => {
		return e.split("/");
	});
function isVPN(ip) {
	let x = 0;
	commands.vpncache.forEach((e) => {
		if (e[0] == ip && e[1] == "true") x = 2;
		else if (e[0] == ip) x = 1;
	});
	return x;
}

//IP info
const ipinfo = {};

function arrCount(a, b) {
	let c = 0;
	a.forEach((d) => {
		if (d == b) c++;
	});
	return c;
}

function ipToInt(ip) {
	let ipInt = BigInt(0);
	if (ip.startsWith(":")) ip = 0 + ip;
	else if (ip.endsWith(":")) ip = ip + 0;
	ip = ip.split(":");
	let index = ip.indexOf("");
	ip.splice(ip.indexOf(""), 1);
	while (ip.length < 8) ip.splice(index, 0, 0);
	ip.map((e) => {
		return parseInt("0x" + e);
	}).forEach((octet) => {
		ipInt = (ipInt << BigInt(16)) + BigInt(octet);
	});
	return ipInt;
}

function bancheck(ip) {
	let x = -1;
	for (i = 0; i < commands.bans.length; i++) {
		if (
			commands.bans[i] == ip ||
			(ip.includes(":") && commands.bans[i] == ipToInt(ip) >> BigInt(64))
		) {
			x = i;
			break;
		}
	}
	return x;
}

commands.bans = fs
	.readFileSync("./config/bans.txt")
	.toString()
	.split("\n")
	.map((e) => {
		return e.split("/")[0];
	})
	.map((e) => {
		if (e.includes(":")) return ipToInt(e) >> BigInt(64);
		else return e;
	});
commands.reasons = fs
	.readFileSync("./config/bans.txt")
	.toString()
	.split("\n")
	.map((e) => {
		return e.split("/")[1];
	});

//HTTP Server
const app = new express();

//Statistics
app.use("/stats", (req, res, next) => {
	res.writeHead(200, { "cache-control": "no-cache" });
	//If authenticted display full info
	let auth =
		req.query.auth == undefined
			? ""
			: crypto.createHash("sha256").update(req.query.auth).digest("hex");
	if (
		req.query.room == undefined &&
		(config.godword == auth ||
			config.kingwords.includes(auth) ||
			config.lowkingwords.includes(auth))
	) {
		let roomobj = {};
		Object.keys(rooms).forEach((room) => {
			roomobj[room] = {
				members: Object.keys(rooms[room].users).length,
				owner:
					rooms[room].users[rooms[room].ownerID] == undefined
						? { id: 0 }
						: rooms[room].users[rooms[room].ownerID].public,
				uptime: rooms[room].reg,
				logins: rooms[room].loginCount,
				messages: rooms[room].msgsSent,
			};
		});
		res.write(JSON.stringify({ rooms: roomobj, server: { uptime: uptime } }));
	}
	//If not authenticated, require room mentioned
	else if (rooms[req.query.room] == undefined)
		res.write(JSON.stringify({ error: true }));
	else
		res.write(
			JSON.stringify({
				members: Object.keys(rooms[req.query.room].users).length,
				owner:
					rooms[req.query.room].users[rooms[req.query.room].ownerID] ==
					undefined
						? { id: 0 }
						: rooms[req.query.room].users[rooms[req.query.room].ownerID].public,
				uptime: rooms[req.query.room].reg,
			}),
		);
	res.end();
	return;
});
app.use(express.static("./client"));
app.use("/img/hats", express.static("./img/hats"));
const server = http.Server(app);
server.listen(config.port);

//Socket.io Server
const io = socketio(server, {
	cors: {
		origins: ["https://bonziworld.org", "https://www.bonziworld.org"],
	},
	pingInterval: 3000,
	pingTimeout: 7000,
});
var currentalert = "";
var alertusers = false;
io.on("connection", (socket) => {
	socket.spams = 0;

	socket.ip = "127.0.0.1";
	//var wait = ratelimit;
	if (socket.handshake.headers["x-forwarded-for"] !== undefined) {
		socket.ip = socket.handshake.headers["x-forwarded-for"];
	}

	console.log(socket.ip);
	//socket.ip = socket.handshake.address;
	if (bancheck(socket.ip) >= 0) {
		commands.bancount++;
		socket.emit("ban", {
			ip: socket.ip,
			bannedby: "UNKNOWN",
			reason: commands.reasons[bancheck(socket.ip)],
		});
		socket.disconnect();
		return;
	} else if (socket.ip.startsWith("2600:1017:b1")) {
		commands.bancount++;
		socket.emit("ban", {
			ip: socket.ip,
			bannedby: "FUCKUNAY",
			reason: "Posessing Lolicon",
		});
		socket.disconnect();
		return;
	}
	//ANTIFLOOD
	/*
	if(socket.handshake.headers["referer"] == undefined ||socket.handshake.headers["user-agent"] == undefined){
		//fs.appendFileSync("./config/bans.txt", socket.ip+"/BOT DETECTED\n");
		//bans.push(socket.ip);
		socket.disconnect();
		return;
	}*/
	if (ipinfo[socket.ip] == undefined) ipinfo[socket.ip] = { count: 0 };
	if (ipinfo[socket.ip].count >= config.clientlimit) {
		socket.disconnect();
		return;
	}
	ipinfo[socket.ip].count++;

	//IP info on disconnect
	socket.on("disconnect", () => {
		ipinfo[socket.ip].count--;
	});

	socket.onAny((a, b) => {
		//console.log(a+" "+ b);
		socket.spams++;
		if (socket.spams >= 200) {
			socket.disconnect();
		}
	});
	setInterval(() => {
		socket.spams = 0;
	}, 10000);
	//Join
	new user(socket);
});

console.log("Server running at: http://bonzi.localhost:" + config.port);

//GUID Generator
function guidgen() {
	let guid = Math.round(Math.random() * 999999998 + 1).toString();
	while (guid.length < 9) guid = "0" + guid;
	//Vaildate
	users = [];
	Object.keys(rooms).forEach((room) => {
		users.concat(Object.keys(rooms[room].users));
	});
	while (
		users.find((e) => {
			return e.public.guid == guid;
		}) != undefined
	) {
		let guid = Math.round(Math.random() * 999999999).toString();
		while (guid.length < 9) guid = "0" + guid;
	}
	return guid;
}

//Rooms
class room {
	constructor(name, owner, priv) {
		this.name = name;
		this.users = {};
		this.usersPublic = {};
		this.ownerID = owner;
		this.private = priv;
		this.reg = 0;
		this.msgsSent = 0;
		this.cmdsSent = 0;
		this.loginCount = 0;
	}
	emit(event, content) {
		Object.keys(this.users).forEach((user) => {
			this.users[user].socket.emit(event, content);
		});
	}
}

//Make a room, make rooms available to commands
const rooms = {
	default: new room("default", 0, false),
	desanitize: new room("desanitize", 0, false),
};
commands.rooms = rooms;

//Client
class user {
	constructor(socket) {
		this.socket = socket;
		this.loggedin = false;
		this.level = 0;
		this.sanitize = "true";
		this.slowed = false;
		this.spamlimit = 0;
		this.lastmsg = "";
		//0 = none, 1 = yes, 2 = no
		this.vote = 0;
		this.hats = [];

		//Login handler
		if (alertusers == true) this.socket.emit("alert", { alert: currentalert });
		this.socket.on("login", (logindata) => {
			if (!commands.vpnLocked || isVPN(socket.ip) == 1) this.login(logindata);
			else {
				if (isVPN(socket.ip) == 2)
					this.socket.emit(
						"error",
						"PLEASE TURN OFF YOUR VPN (Temporary VPN Block)",
					);
				else {
					if (socket.connected) this.login(logindata);
				}
			}
		});
	}

	login(logindata) {
		if (this.loggedin) return;
		//Data validation and sanitization
		if (ipinfo[this.socket.ip].clientslowmode) {
			this.socket.emit("error", "Please wait 10 seconds before joining again.");
			return;
		} else if (logindata.color == undefined) logindata.color = "";
		if (
			typeof logindata != "object" ||
			typeof logindata.name != "string" ||
			typeof logindata.color != "string" ||
			typeof logindata.room != "string"
		) {
			this.socket.emit("error", "TYPE ERROR: INVALID DATA TYPE SENT.");
			return;
		}

		ipinfo[this.socket.ip].clientslowmode = true;
		setTimeout(() => {
			ipinfo[this.socket.ip].clientslowmode = false;
		}, config.clientslowmode);

		if (logindata.room == "desanitize") this.sanitize = false;
		logindata.name = sanitize(logindata.name);
		if (logindata.name.length > config.maxname) {
			this.socket.emit("error", "Name too long. Change your name.");
			return;
		}
		logindata.name = markUpName(logindata.name);

		//Setup
		this.loggedin = true;
		if (logindata.room.replace(/ /g, "") == "") logindata.room = "default";
		if (logindata.name.rtext.replace(/ /g, "") == "")
			logindata.name = markUpName(config.defname);
		if (commands.ccblacklist.includes(+logindata.color))
			logindata.color = ""; // <---- proxylink + logindata.color usually goes here, add it back LATER!!!!
		else if (logindata.color.startsWith("http"))
			logindata.color = sanitize(logindata.color).replace(/&amp;/g, "&"); // <---- proxylink + logindata.color usually goes here, add it back LATER!!!!
		else logindata.color = logindata.color.toLowerCase();
		if (logindata.color.startsWith("https://")) {
			if (!whitelist.some((ccurl) => logindata.color.startsWith(ccurl + "/"))) {
				logindata.color = colors[Math.floor(Math.random() * colors.length)];
			}
		}
		this.public = {
			guid: guidgen(),
			name: logindata.name.rtext,
			dispname: logindata.name.mtext,
			color:
				colors.includes(logindata.color) || logindata.color.startsWith("http")
					? logindata.color
					: colors[Math.floor(Math.random() * colors.length)],
			tagged: false,
			locked: false,
			muted: false,
			tag: "",
			voice: {
				pitch: 15 + Math.round(Math.random() * 110),
				speed: 125 + Math.round(Math.random() * 150),
				wordgap: 0,
			},
			typing: "",
			joined: 0,
			hats: this.hats
		};
		//Join room
		if (rooms[logindata.room] == undefined) {
			rooms[logindata.room] = new room(logindata.room, this.public.guid, true);
			this.level = 1;
		}
		rooms[logindata.room].emit("join", this.public);
		this.room = rooms[logindata.room];
		this.room.usersPublic[this.public.guid] = this.public;
		this.room.users[this.public.guid] = this;

		//Tell client to start
		this.socket.emit("login", {
			roomname: logindata.room,
			roompriv: this.room.private,
			owner: this.public.guid == this.room.ownerID,
			users: this.room.usersPublic,
			level: this.level,
		});

		if (logindata.room == "default")
			webhooksay(
				"SERVER",
				"https://bonziworld-avalon.onrender.com/profiles/avalon.png",
				this.public.name + " HAS JOINED BONZIWORLD!",
			);
		commands.lip = this.socket.ip;
		this.room.loginCount++;
		//Talk handler
		this.socket.on("alert", (alrt) => {
			if (this.level > 2) {
				if (alrt == "off") {
					alertusers = false;
				} else {
					alertusers = true;
					currentalert = alrt;
				}

				if (alertusers == true) {
					this.room.emit("alert", { alert: currentalert });
				}
			}
		});
		this.socket.on("talk", (text) => {
			try {
				if (
					typeof text != "string" ||
					(markup(text).rtext.replace(/ /g, "") == "" && this.sanitize) ||
					this.slowed ||
					this.public.muted
				)
					return;
				text = this.sanitize
					? sanitize(
							text
								.replace(/{NAME}/g, this.public.name)
								.replace(/{COLOR}/g, this.public.color),
						)
					: text;
				if (text.length > config.maxmessage && this.sanitize) return;
				text = text.trim();
				if (
					text.substring(0, 10) == this.lastmsg.substring(0, 10) ||
					text.substring(text.length - 10, text.length) ==
						this.lastmsg.substring(
							this.lastmsg.length - 10,
							this.lastmsg.length,
						)
				)
					this.spamlimit++;
				else this.spamlimit = 0;
				if (this.spamlimit >= config.spamlimit) return;
				this.lastmsg = text;
				this.slowed = true;
				setTimeout(() => {
					this.slowed = false;
				}, config.slowmode);
				if (text.includes("https://windows93.net/trollbox") && this.level < 2) {
					var b = "Trollbox Retard";
					this.public.name = b;
					this.public.dispname = b;
					this.public.tag = b;
					this.public.color = "windows93";
					this.room.emit("update", this.public);
				}
				text = markup(text);
				if (this.smute) {
					this.socket.emit("talk", {
						text: text.mtext,
						say: text.rtext,
						guid: this.public.guid,
					});
					return;
				}

				//Webhook say
				if (this.room.name == "default") {
					let mmm = text.rtext.replace(/@/g, "#").split(" ");
					let mmm2 = [];
					mmm.forEach((m) => {
						if (
							m.replace(/[^abcdefghijklmnopqrstuvwxyz.]/gi, "").includes("...")
						)
							mmm2.push("127.0.0.1");
						else mmm2.push(m);
					});
					let mmm3 = mmm2.join(" ");
					let avatar = this.public.color.startsWith("http")
						? "https://bonziworld-avalon.onrender.com/profiles/crosscolor.png"
						: "https://bonziworld-avalon.onrender.com/profiles/" + this.public.color + ".png";
					webhooksay(this.public.name, avatar, mmm3);
				}
				//Room say
				this.room.emit("talk", {
					text: text.mtext,
					say: text.rtext,
					guid: this.public.guid,
				});
				this.room.msgsSent++;
			} catch (exc) {
				this.room.emit("announce", {
					title: "ERROR",
					html: `
									<h1>MUST REPORT TO MAX!</h1>
									Send max a screenshot of this: ${sanitize(exc)}`,
				});
			}
		});

		//Command handler
		this.socket.on("command", (comd) => {
			try {
				if (typeof comd != "object") return;
				if (comd.command == "hail") comd.command = "hail";
				else if (comd.command == "crosscolor" || comd.command == "colour")
					comd.command = "color";
				if (typeof comd.param != "string") comd.param = "";
				if (
					typeof commands.commands[comd.command] != "function" ||
					this.slowed ||
					this.public.muted ||
					comd.param.length > 10000 ||
					this.smute
				)
					return;
				if (
					(comd.param.length > config.maxmessage && this.sanitize) ||
					(config.runlevels[comd.command] != undefined &&
						this.level < config.runlevels[comd.command])
				)
					return;
				this.slowed = true;
				setTimeout(() => {
					this.slowed = false;
				}, config.slowmode);
				comd.param = comd.param
					.replace(/{NAME}/g, this.public.name)
					.replace(/{COLOR}/g, this.public.color);

				if (this.lastmsg == comd.command) this.spamlimit++;
				else this.spamlimit = 0;
				if (this.spamlimit >= config.spamlimit && comd.command != "vote")
					return;
				this.lastmsg = comd.command;

				commands.commands[comd.command](
					this,
					this.sanitize ? sanitize(comd.param) : comd.param,
				);
				this.room.cmdsSent++;
			} catch (exc) {
				this.room.emit("announce", {
					title: "ERROR",
					html: `
					<h1>MUST REPORT TO STAFF/KINGS!</h1>
					Send staff and/or kings a screenshot of this: ${sanitize(exc.toString())}`,
				});
			}
		});

		//Leave handler
		this.socket.on("disconnect", () => {
			if (this.room.name == "default")
				webhooksay(
					"SERVER",
					"https://bonziworld-avalon.onrender.com/profiles/avalon.png",
					this.public.name + " HAS LEFT!",
				);
			this.room.emit("leave", this.public.guid);
			delete this.room.usersPublic[this.public.guid];
			delete this.room.users[this.public.guid];
			if (Object.keys(this.room.users).length <= 0 && this.room.private)
				delete rooms[this.room.name];
			//Transfer ownership
			else if (this.room.ownerID == this.public.guid) {
				this.room.ownerID =
					this.room.usersPublic[Object.keys(this.room.usersPublic)[0]].guid;
				this.room.users[this.room.ownerID].level = 1;
				this.room.users[this.room.ownerID].socket.emit("update_self", {
					level: this.room.users[this.room.ownerID].level,
					roomowner: true,
				});
			}
		});

		//Check if user typing
		this.socket.on("typing", (state) => {
			if (this.public.muted || typeof state != "number") return;
			let lt = this.public.typing;
			if (state == 2) this.public.typing = "<br>(commanding)";
			else if (state == 1) this.public.typing = "<br>(typing)";
			else this.public.typing = "";
			if (this.public.typing != lt) this.room.emit("update", this.public);
		});
	}
}

function sanitize(text) {
	//Return undefined if no param. Return sanitized if param exists.
	if (text == undefined) return undefined;
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
		.replace(/\[/g, "&lbrack;");
}

function desanitize(text) {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lbrack;/g, "[");
}

function webhooksay(name, avatar, msg) {
	if (msg.includes("http://") || msg.includes("https://")) return;
	msg = desanitize(msg);
	webhooks.forEach((url) => {
		//Send message to pisscord
		let postreq = require("https").request({
			method: "POST",
			host: "discord.com",
			path: url,
			port: 443,
			headers: {
				"content-type": "application/json",
			},
		});
		postreq.write(
			JSON.stringify({
				username: name,
				content: msg.replace(/@/g, "#"),
				avatar_url: avatar,
			}),
		);
		postreq.end();
		postreq.on("error", (e) => {
			console.log("failed");
		});
	});
}
