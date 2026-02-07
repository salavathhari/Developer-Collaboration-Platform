const express = require("express");

const {
	register,
	login,
	refreshAccessToken,
	logout,
} = require("../controllers/authController");
const { validateRegister, validateLogin } = require("../middleware/validators");

const router = express.Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);

module.exports = router;
