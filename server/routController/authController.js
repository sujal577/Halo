import User from "../schema/userSchema.js";
import bcrypt from "bcryptjs";
import jwtToken from "../utils/jwtTokens.js";
import { inMemoryUsers } from "../db/database.js";
import mongoose from "mongoose";

// Helper function to check if MongoDB is connected
const isMongoConnected = () => {
    return mongoose.connection.readyState === 1;
};

// Helper to generate a mock ID for in-memory storage
const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
};

export const Signup = async(req,res)=>{
    try{
        const {fullname, username, email, password, gender, profilepic} = req.body;
        
        if (isMongoConnected()) {
            // Use MongoDB if connected
            const user = await User.findOne({ username });
            if(user) return res.status(500).send({success:false, message: "User already Exists with the username"});
            const emailpresent  = await User.findOne({ email});
            if(emailpresent) return res.status(500).send({success:false, message:"Email already Exists"});
            const hashPassword = bcrypt.hashSync(password, 10);
            const boyppf = profilepic || `https://avatar.iran.liara.run/public/boy?username=${username}`
            const girlppf = profilepic || `https://avatar.iran.liara.run/public/girl?username=${username}`
            
            const newUser = new User({
                fullname,
                username,
                email,
                password: hashPassword, 
                gender,
                profilepic: gender === "male" ? boyppf : girlppf
            });
            if(newUser){
                await newUser.save();

            } else{
                res.status(500).send({success:false, message:"Invalid User Data"});
            }
            res.status(201).send({
              message: "Signup Successful!!"  
            });
        } else {
            // Use in-memory storage
            const existingUser = inMemoryUsers.find(u => u.username === username || u.email === email);
            if (existingUser) {
                return res.status(500).send({success:false, message: "User already Exists with the username or email"});
            }
            
            const hashPassword = bcrypt.hashSync(password, 10);
            const boyppf = profilepic || `https://avatar.iran.liara.run/public/boy?username=${username}`
            const girlppf = profilepic || `https://avatar.iran.liara.run/public/girl?username=${username}`
            
            const newUser = {
                _id: generateId(),
                fullname,
                username,
                email,
                password: hashPassword,
                gender,
                profilepic: gender === "male" ? boyppf : girlppf,
                createdAt: new Date()
            };
            
            inMemoryUsers.push(newUser);
            res.status(201).send({
              message: "Signup Successful!!"  
            });
        }


   }
    catch (error){
        res.status(500).send({
            success:false,
            message: error.message || "Something went wrong during signup"
        });
        console.log(error);
    }
}

export const Login=async(req,res)=>{
    try{
        const { email, password } = req.body
        
        if (isMongoConnected()) {
            // Use MongoDB if connected
            const user=await User.findOne({ email});
            if(!user) return res.status(500).send({success:false, message:"Email doesn't Exist"});
            const comparePassword = bcrypt.compareSync(password, user.password);
            if(!comparePassword) return res.status(500).send({success:false, message:"Email or Password is Incorrect"});
            const token = jwtToken(user._id, res);

            res.status(200).send({
                _id:user._id,
                fullname:user.fullname,
                username:user.username,
                profilepic:user.profilepic,
                email:user.email,
                message:"Successfully Login",
                token

            })
        } else {
            // Use in-memory storage
            const user = inMemoryUsers.find(u => u.email === email);
            if(!user) return res.status(500).send({success:false, message:"Email doesn't Exist"});
            const comparePassword = bcrypt.compareSync(password, user.password);
            if(!comparePassword) return res.status(500).send({success:false, message:"Email or Password is Incorrect"});
            const token = jwtToken(user._id, res);

            res.status(200).send({
                _id:user._id,
                fullname:user.fullname,
                username:user.username,
                profilepic:user.profilepic,
                email:user.email,
                message:"Successfully Login",
                token

            })
        }
    }
    catch (error){
        res.status(500).send({
            success:false,
            message: error.message || "Something went wrong during login"
        });
        console.log(error);
    }
}

export const Logout=async(req,res)=>{
    try{
        res.clearCookie('jwt', {
            path:'/',
            httpOnly:true,
            secure:process.env.NODE_ENV === 'production',
        });
        res.status(200).send({
            message: "Logged out successfully"
        });
    } catch (error) {
        res.status(500).send({
            success:false,
            message: error.message || "Something went wrong during logout"
        });
        console.log(error);
    }
}