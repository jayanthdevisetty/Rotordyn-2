import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_URL || (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname)
        ? `http://${window.location.hostname}:8000`
        : 'https://rotordyn-2.onrender.com'
);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const verifyingTokenRef = useRef(null);

    const verifySession = async (currentToken) => {
        if (!currentToken) {
            verifyingTokenRef.current = null;
            setUser(null);
            setLoading(false);
            return;
        }

        if (verifyingTokenRef.current === currentToken) {
            console.log("verifySession: Token already verifying/verified, skipping duplicate.");
            return;
        }
        verifyingTokenRef.current = currentToken;

        console.log("verifySession: Verifying session with token...");

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
            
            // Merge metadata properties from Supabase Auth user record (which handles report_generation_count)
            const mergedProfile = {
                ...profile,
                subscription_status: authUser.user_metadata?.subscription_status || profile.subscription_status || 'free-tier',
                report_generation_count: parseInt(authUser.user_metadata?.report_generation_count || profile.report_generation_count || 0, 10)
            };
            setUser(mergedProfile);
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
                verifyingTokenRef.current = null;
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
        verifyingTokenRef.current = null;
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
        <AuthContext.Provider value={{ user, setUser, token, loading, login, register, logout, saveToken, API_BASE_URL }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
