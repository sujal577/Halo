import User from "../schema/userSchema.js";
import jwt from "jsonwebtoken";

const isLogin = async (req, res, next) => {
    try {
        const token = req.cookies.jwt || req.headers.cookie.split("; ").find((cookie) => cookie.startsWith("jwt="))?.split("=")[1];
        if (!token) return res.status(500).send({
            success: false,
            message: "User unauthorized"
        });
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        if (!decode) return res.status(500).send({
            success: false,
            message: "User unauthorized - Invalid token"
        });
        const user = await User.findById(decode.userId).select("-password");
        if (!user) return res.status(500).send({
            success: false,
            message: "User unauthorized - User not found"
        });
        req.user = user;
        next();
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error
        })
    }
}

export default isLogin;