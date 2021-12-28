import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { kontenbase } from "lib/client";
import { Thread } from "types";

type FetchThreadsProps = {
  channelId: string;
};

type InitThreadState = {
  threads: Thread[];
  loading: boolean;
};

export const fetchThreads = createAsyncThunk(
  "channel/fetchThreads",
  async ({ channelId }: FetchThreadsProps) => {
    const response = await kontenbase
      .service("Threads")
      .find({ where: { channel: channelId } });

    const parsedThreadsDraft: object = JSON.parse(
      localStorage.getItem("threadsDraft")
    );

    let draft = [];

    if (parsedThreadsDraft) {
      draft = Object.entries(parsedThreadsDraft)
        .map(([key, value]) => ({
          id: key,
          draft: true,
          ...value,
        }))
        .filter((data) => data.channelId === channelId);
    }

    return [...draft, ...response.data];
  }
);

const initialState: InitThreadState = {
  threads: [],
  loading: true,
};

const threadSlice = createSlice({
  name: "thread",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchThreads.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      fetchThreads.fulfilled,
      (state, action: PayloadAction<Thread[]>) => {
        state.threads = action.payload;
        state.loading = false;
      }
    );
    builder.addCase(fetchThreads.rejected, (state) => {
      state.loading = false;
    });
  },
});

export const threadReducer = threadSlice.reducer;
