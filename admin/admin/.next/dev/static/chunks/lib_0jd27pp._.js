(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ApiError",
    ()=>ApiError,
    "api",
    ()=>api,
    "apiErrorMessage",
    ()=>apiErrorMessage,
    "clearTokens",
    ()=>clearTokens,
    "downloadText",
    ()=>downloadText,
    "getRefreshToken",
    ()=>getRefreshToken,
    "getToken",
    ()=>getToken,
    "setAfterTokenRefresh",
    ()=>setAfterTokenRefresh,
    "setRefreshToken",
    ()=>setRefreshToken,
    "setSessionTokens",
    ()=>setSessionTokens,
    "setToken",
    ()=>setToken,
    "toCsv",
    ()=>toCsv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
const TOKEN_KEY = "eve_admin_token";
const REFRESH_KEY = "eve_admin_refresh";
const AUTH_SKIP_REFRESH = new Set([
    "/auth/admin/login",
    "/auth/admin/refresh",
    "/auth/admin/logout"
]);
function apiBase() {
    const value = ("TURBOPACK compile-time value", "http://localhost:4000/api");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return value.replace(/\/$/, "");
}
function getToken() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return window.localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
    if (token) {
        window.localStorage.setItem(TOKEN_KEY, token);
    } else {
        window.localStorage.removeItem(TOKEN_KEY);
    }
}
function getRefreshToken() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return window.localStorage.getItem(REFRESH_KEY);
}
function setRefreshToken(token) {
    if (token) {
        window.localStorage.setItem(REFRESH_KEY, token);
    } else {
        window.localStorage.removeItem(REFRESH_KEY);
    }
}
function clearTokens() {
    setToken(null);
    setRefreshToken(null);
}
function setSessionTokens(accessToken, refreshToken) {
    setToken(accessToken);
    setRefreshToken(refreshToken);
}
let afterTokenRefresh = null;
function setAfterTokenRefresh(handler) {
    afterTokenRefresh = handler;
}
let refreshInFlight = null;
async function tryRefresh() {
    if (refreshInFlight) {
        return refreshInFlight;
    }
    refreshInFlight = (async ()=>{
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            return false;
        }
        try {
            const response = await fetch(`${apiBase()}/auth/admin/refresh`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    refreshToken
                })
            });
            const payload = await response.json().catch(()=>({}));
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    clearTokens();
                }
                return false;
            }
            if (typeof payload.accessToken !== "string" || typeof payload.refreshToken !== "string") {
                return false;
            }
            setSessionTokens(payload.accessToken, payload.refreshToken);
            afterTokenRefresh?.();
            return true;
        } catch  {
            return false;
        }
    })().finally(()=>{
        refreshInFlight = null;
    });
    return refreshInFlight;
}
class ApiError extends Error {
    status;
    constructor(status, message){
        super(message);
        this.status = status;
    }
}
function apiErrorMessage(error) {
    return error instanceof ApiError ? error.message : "Something went wrong";
}
async function api(path, options = {}) {
    const run = async ()=>{
        const token = getToken();
        const headers = new Headers(options.headers);
        headers.set("Content-Type", "application/json");
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        const response = await fetch(`${apiBase()}${path}`, {
            ...options,
            headers
        });
        const payload = await response.json().catch(()=>({}));
        return {
            response,
            payload
        };
    };
    let { response, payload } = await run();
    if (response.status === 401 && !AUTH_SKIP_REFRESH.has(path)) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            ({ response, payload } = await run());
        }
    }
    if (!response.ok) {
        throw new ApiError(response.status, payload.message ?? "Request failed");
    }
    return payload;
}
function toCsv(rows) {
    if (rows.length === 0) {
        return "";
    }
    const headers = Object.keys(rows[0]);
    const escape = (value)=>`"${String(value ?? "").replaceAll('"', '""')}"`;
    return [
        headers.join(","),
        ...rows.map((row)=>headers.map((key)=>escape(row[key])).join(","))
    ].join("\n");
}
function downloadText(filename, content, type) {
    const blob = new Blob([
        content
    ], {
        type
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/auth-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/socket.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function hasStoredTokens() {
    return Boolean((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getToken"])() || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRefreshToken"])());
}
function AuthProvider({ children }) {
    _s();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [hasSession, setHasSession] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAfterTokenRefresh"])({
                "AuthProvider.useEffect": ()=>{
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["reconnectAdminSocket"])();
                }
            }["AuthProvider.useEffect"]);
            return ({
                "AuthProvider.useEffect": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAfterTokenRefresh"])(null)
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], []);
    const logout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[logout]": async ()=>{
            const refreshToken = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRefreshToken"])();
            if (refreshToken) {
                try {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"])("/auth/admin/logout", {
                        method: "POST",
                        body: JSON.stringify({
                            refreshToken
                        })
                    });
                } catch  {
                // Local sign-out still proceeds if the revoke call fails.
                }
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["disconnectAdminSocket"])();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clearTokens"])();
            setUser(null);
            setHasSession(false);
        }
    }["AuthProvider.useCallback[logout]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            let cancelled = false;
            async function restoreSession() {
                if (!hasStoredTokens()) {
                    if (!cancelled) setLoading(false);
                    return;
                }
                try {
                    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"])("/auth/me");
                    if (cancelled) return;
                    if (result.user.role !== "ADMIN") {
                        await logout();
                        return;
                    }
                    setUser(result.user);
                    setHasSession(true);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectAdminSocket"])();
                } catch (error) {
                    if (cancelled) return;
                    const unauthenticated = error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ApiError"] && error.status === 401 && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRefreshToken"])();
                    if (unauthenticated) {
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["disconnectAdminSocket"])();
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clearTokens"])();
                        setUser(null);
                        setHasSession(false);
                    } else if (hasStoredTokens()) {
                        setHasSession(true);
                    }
                } finally{
                    if (!cancelled) setLoading(false);
                }
            }
            void restoreSession();
            return ({
                "AuthProvider.useEffect": ()=>{
                    cancelled = true;
                }
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], [
        logout
    ]);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AuthProvider.useMemo[value]": ()=>({
                user,
                loading,
                hasSession,
                async login (email, password) {
                    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"])("/auth/admin/login", {
                        method: "POST",
                        body: JSON.stringify({
                            email,
                            password
                        })
                    });
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setSessionTokens"])(result.accessToken, result.refreshToken);
                    setUser(result.user);
                    setHasSession(true);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$socket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["reconnectAdminSocket"])();
                },
                logout
            })
    }["AuthProvider.useMemo[value]"], [
        user,
        loading,
        hasSession,
        logout
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/auth-context.tsx",
        lineNumber: 146,
        columnNumber: 5
    }, this);
}
_s(AuthProvider, "k780JVe/L1xvMv4X0fjLNa9uZNY=");
_c = AuthProvider;
function useAuth() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
_s1(useAuth, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/socket.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addAdminSocketListener",
    ()=>addAdminSocketListener,
    "addConnectionListener",
    ()=>addConnectionListener,
    "connectAdminSocket",
    ()=>connectAdminSocket,
    "disconnectAdminSocket",
    ()=>disconnectAdminSocket,
    "reconnectAdminSocket",
    ()=>reconnectAdminSocket,
    "subscribeTrip",
    ()=>subscribeTrip,
    "unsubscribeTrip",
    ()=>unsubscribeTrip,
    "useAdminSocket",
    ()=>useAdminSocket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/socket.io-client/build/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
let socket = null;
let subscribedTripId = null;
const listeners = new Set();
const connectionListeners = new Set();
function socketUrl() {
    const value = ("TURBOPACK compile-time value", "http://localhost:4000/api") ?? "";
    return value.replace(/\/api\/?$/, "");
}
function notifyConnection(connected) {
    for (const listener of connectionListeners){
        listener(connected);
    }
}
function addAdminSocketListener(listener) {
    listeners.add(listener);
    return ()=>{
        listeners.delete(listener);
    };
}
function addConnectionListener(listener) {
    connectionListeners.add(listener);
    listener(Boolean(socket?.connected));
    return ()=>{
        connectionListeners.delete(listener);
    };
}
function connectAdminSocket() {
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getToken"])();
    if (!token) {
        return null;
    }
    if (socket?.connected) {
        return socket;
    }
    socket?.disconnect();
    socket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["io"])(socketUrl(), {
        auth: {
            token
        },
        transports: [
            "websocket"
        ]
    });
    socket.onAny((event, payload)=>{
        for (const listener of listeners){
            listener(event, payload);
        }
    });
    socket.on("connect", ()=>{
        notifyConnection(true);
        if (subscribedTripId) {
            socket?.emit("trip:subscribe", subscribedTripId);
        }
    });
    socket.on("disconnect", ()=>notifyConnection(false));
    socket.on("connect_error", ()=>notifyConnection(false));
    return socket;
}
function reconnectAdminSocket() {
    socket?.disconnect();
    socket = null;
    notifyConnection(false);
    return connectAdminSocket();
}
function disconnectAdminSocket() {
    subscribedTripId = null;
    socket?.disconnect();
    socket = null;
    notifyConnection(false);
}
function subscribeTrip(tripId) {
    subscribedTripId = tripId;
    const client = connectAdminSocket();
    if (client?.connected) {
        client.emit("trip:subscribe", tripId);
    }
}
function unsubscribeTrip() {
    subscribedTripId = null;
}
function useAdminSocket() {
    _s();
    const [connected, setConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(Boolean(socket?.connected));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAdminSocket.useEffect": ()=>{
            connectAdminSocket();
            return addConnectionListener(setConnected);
        }
    }["useAdminSocket.useEffect"], []);
    return {
        connected
    };
}
_s(useAdminSocket, "fnLcEQjr+B177cspcUDUxrvNQmQ=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=lib_0jd27pp._.js.map