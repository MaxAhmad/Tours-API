const { promisify } = require("util");

const jwt = require("jsonwebtoken");

const User = require("../models/userModel");
const config = require("../config/config");

// Create Token
const signToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

// Send Token handler to user after sign in and login in
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOption = {
    expires: new Date(
      Date.now() + config.JWT_COOKIES_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    //secure: true,
    httpOnly: true,
  };

  res.cookie('jwt', token, cookieOption);

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

// Sign up user handler
exports.signup = async (req, res, next) => {
  const newUser = await User.create({
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
  });

  createSendToken(newUser, 201, res);
};

//Login Handler
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  //check if email and password exist
  if (!email || !password) {
    res.status(400).json({
      message: "Please provide your email and password"
    })
  }
  //check if user exists and password is correct
  const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new Error(err.message))
    }

  createSendToken(user, 200, res);
};

//AUthentication Middleware
exports.authorize = async (req, res, next) => {
  let token;
  // check for token in the authorisation header and browser cookie
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // check if token is valid
  if (!token) {
    return next(new Error("Please login to get access", 401))
  }

  //Validate token
  const decoded = await promisify(jwt.verify)(token, config.JWT_SECRET);

  //check if users exist
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new Error('This User does not exist', 401))
  }

  // Set the user 
  req.user = currentUser;
  next();
};

// Middleware only for rendered pages, does not send errors!
exports.loggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        config.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      //  the locals variable makes the current user accesible by the axios library
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

//Middleware for logout function in the browser
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};