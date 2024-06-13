require("dotenv").config();

const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");
const User = require("./models/user.model");
const Note = require("./models/note.model");
const app = express();

const port = process.env.PORT;
const connectionString = process.env.CONNECTION_STRING;
mongoose.connect(connectionString);

app.use(express.json());

const allowedOrigins = ["https://noteease.netlify.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Origin",
      "X-Requested-With",
      "Accept",
      "Authorization",
    ],
    credentials: true,
  })
);

// Handle preflight requests
app.options(
  "*",
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Origin",
      "X-Requested-With",
      "Accept",
      "Authorization",
    ],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.status(200).send("Backend Running.");
});

app.get("/", (req, res) => {
  res.status(200).send("Backend Running.");
});

//Create Account
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName) {
    return res.status(400).json({
      error: true,
      message: "Full Name is required",
    });
  }

  if (!email) {
    return res.status(400).json({
      error: true,
      message: "Email is required",
    });
  }

  if (!password) {
    return res.status(400).json({
      error: true,
      message: "Password is required",
    });
  }

  const isUser = await User.findOne({ email: email });

  if (isUser) {
    return res.json({
      error: true,
      message: "User already exists",
    });
  }

  const user = new User({
    fullName,
    email,
    password,
  });

  await user.save();

  const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "36000m",
  });

  return res.json({
    error: false,
    user,
    accessToken,
    message: "Registration Successful",
  });
});

//Delete Account
app.delete("/delete-account", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const isUser = await User.findOne({ _id: user.user._id });

    if (!isUser) {
      return res.status(404).json({
        error: true,
        message: "User not found",
      });
    }

    await Note.deleteMany({ userId: user.user._id });
    await User.deleteOne({ _id: user.user._id });

    return res.json({
      error: false,
      message: "User and all associated notes deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({
      error: true,
      message: "Email is required",
    });
  }

  if (!password) {
    return res.status(400).json({
      error: true,
      message: "Password is required",
    });
  }

  const userInfo = await User.findOne({ email: email });

  if (!userInfo) {
    return res.status(400).json({ message: "User not found" });
  }

  if (userInfo.email == email && userInfo.password == password) {
    const user = { user: userInfo };
    const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "36000m",
    });

    return res.json({
      error: false,
      message: "Login Successful",
      email,
      accessToken,
    });
  } else {
    return res.status(400).json({
      error: true,
      message: "Invalid Credentials",
    });
  }
});

//Get User
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;

  const isUser = await User.findOne({ _id: user.user._id });

  if (!isUser) {
    return res.sendStatus(401);
  }

  return res.json({
    user: {
      fullName: isUser.fullName,
      email: isUser.email,
      _id: isUser._id,
      createdOn: isUser.createdOn,
    },
    message: "User found successfully",
  });
});

//Add Note
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;

  if (!title) {
    return res.status(400).json({
      error: true,
      message: "Title is required",
    });
  }

  if (!content) {
    return res.status(400).json({
      error: true,
      message: "Content is required",
    });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user.user._id,
    });

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Edit Note
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags, isPinned } = req.body;
  const { user } = req.user;

  if (!title && !content && !tags) {
    return res.status(400).json({
      error: true,
      message: "No changes provided",
    });
  }

  try {
    const note = await Note.findOne({
      _id: noteId,
      userId: user.user._id,
    });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found",
      });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();

    return res.json({
      errro: false,
      note,
      message: "Note added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Get All Notes
app.get("/get-all-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const notes = await Note.find({
      userId: user.user._id,
    }).sort({
      isPinned: -1,
    });

    return res.json({
      error: false,
      notes,
      message: "All notes retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Delete Note
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { user } = req.user;

  try {
    const note = await Note.findOne({
      _id: noteId,
      userId: user.user._id,
    });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found",
      });
    }

    await Note.deleteOne({
      _id: noteId,
      userId: user.user._id,
    });

    return res.json({
      error: false,
      message: "Note deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Update isPinned Value
app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { isPinned } = req.body;
  const { user } = req.user;

  try {
    const note = await Note.findOne({
      _id: noteId,
      userId: user.user._id,
    });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found",
      });
    }

    note.isPinned = isPinned;

    await note.save();

    return res.json({
      errro: false,
      note,
      message: "Note added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Search Notes
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      error: true,
      message: "Serach query is required",
    });
  }

  try {
    const matchingNotes = await Note.find({
      userId: user.user._id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } },
        { content: { $regex: new RegExp(query, "i") } },
        { tags: { $regex: new RegExp(query, "i") } },
      ],
    });

    return res.json({
      error: false,
      notes: matchingNotes,
      message: "Notes matching the search query retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
