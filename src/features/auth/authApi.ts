import { createApi } from "@reduxjs/toolkit/query/react";
import { apiBaseQuery } from "../../lib/rtkBaseQuery";

export interface User {
    id: string;
    email: string;
}

interface Credentials {
    email: string;
    password: string;
}

export const authApi = createApi({
    reducerPath: "authApi",
    baseQuery: apiBaseQuery,
    tagTypes: ["Session"],
    endpoints: (builder) => ({
        // Queried on app load to establish whether a session cookie is
        // already valid. A 401 here is an expected, ordinary "logged out"
        // state, not an error to surface -- callers check `isError`, not a
        // toast.
        getMe: builder.query<User, void>({
            query: () => "/auth/me",
            transformResponse: (response: { user: User }) => response.user,
            providesTags: ["Session"],
        }),
        register: builder.mutation<User, Credentials>({
            query: (body) => ({ url: "/auth/register", method: "POST", body }),
            transformResponse: (response: { user: User }) => response.user,
            invalidatesTags: ["Session"],
        }),
        login: builder.mutation<User, Credentials>({
            query: (body) => ({ url: "/auth/login", method: "POST", body }),
            transformResponse: (response: { user: User }) => response.user,
            invalidatesTags: ["Session"],
        }),
        logout: builder.mutation<void, void>({
            query: () => ({ url: "/auth/logout", method: "POST" }),
            invalidatesTags: ["Session"],
        }),
    }),
});

export const { useGetMeQuery, useRegisterMutation, useLoginMutation, useLogoutMutation } = authApi;
