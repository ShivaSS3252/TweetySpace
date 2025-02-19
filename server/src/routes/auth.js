import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import newUser from "../models/signinModel.js";
import initializeCollections from "../utils/initializeCollections.js";
import isAuthenticated from "../middlewares/authentication_middleware.js";

const authRouter = express.Router();

// Signup
authRouter.post("/signup", async (req, res) => {
  try {
    const { FullName, UserName, emailId, Password } = req.body;
    const passwordHash = await bcrypt.hash(Password, 10);

    // Creating new user in Signup model
    const user = new newUser({
      FullName,
      UserName,
      emailId,
      Password: passwordHash,
    });

    // Saving sigup data
    const userSave = await user.save();

    const [profileSave, followersSave] = await initializeCollections(userSave);

    const authToken = await jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "8h",
      }
    );
    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: new Date(Date.now() + 8 * 3600000), // cookie will be removed after 8 hours
    });

    res.status(200).json({
      message: "Signed Up Successfully",
      Sigin: userSave,
      profile: profileSave,
      followers: followersSave,
    });
  } catch (err) {
    // Validation Error
    if (err.name === "ValidationError") {
      // Extract validation errors
      const errors = Object.values(err.errors).map((error) => error.message);
      return res.status(400).json({ validationErrors: errors }); // Send errors to the client
    } else if (err.name === "MongoServerError") {
      res.status(400).json({ message: "MongoServerError", error: err.message });
    } else {
      console.log(err.name);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: err.message });
    }
  }
});

// Signin
authRouter.post("/signin", async (req, res) => {
  try {
    const { UserName, Password } = req.body;

    // Extracting the password from db based on username.
    const user = await newUser
      .findOne({ UserName: UserName })
      .select("Password");

    if (!user) {
      // No User Found
      console.log("User not found");
      res.status(401).json({ message: "User not found" });
    } else {
      // Comparing the entered password and actual password
      const isMatch = await bcrypt.compare(Password, user.Password);

      if (isMatch) {
        // Correct password
        const authToken = await jwt.sign(
          { _id: user._id },
          process.env.JWT_SECRET_KEY,
          {
            expiresIn: "1d",
          }
        );

        res.cookie("authToken", authToken, {
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
          maxAge: new Date(Date.now() + 8 * 3600000), // cookie will be removed after 8 hours
        });

        res.status(200).json({ message: "Signed In Successfully" });
      } else {
        // Incorrect password
        console.log("Incorrect password");
        res.status(401).json({ message: "Incorrect password" });
      }
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
});

// Signout
authRouter.post("/signout", isAuthenticated, async (req, res) => {
  try {
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
});

export default authRouter;
