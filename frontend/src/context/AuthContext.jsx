import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000'
        : 'https://rotordyn-ai-v2.onrender.com'
);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const verifySession = async (currentToken) => {
        console.log("verifySession: Verifying session with token...");
        if (!currentToken) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            // Get user session directly from Supabase
            const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(currentToken);
            
            if (authErr || !authUser) {
                console.warn("verifySession: Token validation failed, logging out.");
                logout();
                return;
            }

            // Retrieve custom metadata from public.profiles table
            const { data: profile, error: profileErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (profileErr || !profile) {
                console.warn("verifySession: User profile record not found in public.profiles table.");
                logout();
                return;
            }

            console.log("verifySession: Profile loaded successfully:", profile);
            setUser(profile);
        } catch (err) {
            console.error('verifySession: Error checking session:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Sync initial session on mount
        const initSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const currentToken = session.access_token;
                localStorage.setItem('token', currentToken);
                setToken(currentToken);
                await verifySession(currentToken);
            } else {
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
                setLoading(false);
            }
        };

        initSession();

        // Register listener for session changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("onAuthStateChange: Auth event fired:", event);
            if (session) {
                const currentToken = session.access_token;
                localStorage.setItem('token', currentToken);
                setToken(currentToken);
                await verifySession(currentToken);
            } else {
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            throw new Error(error.message || 'Login failed');
        }

        // Fetch profile to verify
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileErr || !profile) {
            throw new Error('Verification failed. User profile record missing.');
        }

        // Return token and profile
        return { token: data.session.access_token, user: profile };
    };

    const register = async (name, email, password, company, plant, purpose) => {
        // Signup in Supabase Auth
        // Options.data stores metadata used by the handle_new_user trigger
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    company,
                    plant,
                    purpose,
                    role: 'user',
                    status: 'pending'
                }
            }
        });

        if (error) {
            throw new Error(error.message || 'Registration failed');
        }

        return data.user;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    const saveToken = (newToken, newUser = null) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        if (newUser) {
            setUser(newUser);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, saveToken, API_BASE_URL }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
