import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const chatApi = createApi({
    reducerPath: 'chatApi',
    baseQuery: fetchBaseQuery({ baseUrl: 'https://week4day4-production.up.railway.app/api' }),
    tagTypes: ['User', 'Message'],
    endpoints: (builder) => ({
        getUsers: builder.query({
            query: () => '/users',
            providesTags: ['User'],
        }),
        getMessages: builder.query({
            query: () => '/messages',
            providesTags: ['Message'],
        }),
        loginUser: builder.mutation({
            query: (credentials) => ({
                url: '/users/login',
                method: 'POST',
                body: credentials,
            }),
            invalidatesTags: ['User'],
        }),
        registerUser: builder.mutation({
            query: (credentials) => ({
                url: '/users/register',
                method: 'POST',
                body: credentials,
            }),
            invalidatesTags: ['User'],
        }),
        updateUser: builder.mutation({
            query: ({ id, ...patch }) => ({
                url: `/users/${id}`,
                method: 'PUT',
                body: patch,
            }),
            invalidatesTags: ['User'],
        }),
        getDirectMessages: builder.query({
            query: ({ userId, otherId }) => `/messages/direct/${userId}/${otherId}`,
            providesTags: ['Message'],
        }),
    }),
});

export const { 
    useGetUsersQuery, 
    useGetMessagesQuery, 
    useLoginUserMutation,
    useRegisterUserMutation,
    useUpdateUserMutation,
    useGetDirectMessagesQuery
} = chatApi;
