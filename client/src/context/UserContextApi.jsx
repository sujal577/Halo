import { createContext, useContext, useState } from "react";

// Create the context
const UserContext = createContext();

// Provider component to wrap around your app
export const UserProvider = ({ children }) => {
    // Initialize state with localStorage data to prevent flickering issues
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem("userData");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    // Function to update user data
    const updateUser = (newUserData) => {
        setUser(newUserData);
        localStorage.setItem("userData", JSON.stringify(newUserData));
    };

    return (
        <UserContext.Provider value={{ user, updateUser }}>
            {children}
        </UserContext.Provider>
    );
};

// Custom hook for consuming the context
// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};