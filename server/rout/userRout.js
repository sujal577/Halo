import express from "express";
import {
  getAllUsers,
  getUserByUsernameOrEmail,
  getUserById,
  getCallHistory,
} from "../routController/userController.js";
import isLogin from "../middleware/isLogin.js";

const router = express.Router();

router.get("/", isLogin, getAllUsers);
router.get("/call-history", isLogin, getCallHistory);
router.get("/search", isLogin, getUserByUsernameOrEmail);
router.get("/:id", getUserById);

export default router;