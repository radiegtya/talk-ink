import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { kontenbase } from "lib/client";
import { Workspace } from "types";

type FetchWorkspacesProps = {
  userId: string;
};

export const fetchWorkspaces = createAsyncThunk(
  "workspace/fetchWorkspaces",
  async ({ userId }: FetchWorkspacesProps) => {
    const response = await kontenbase
      .service("Workspaces")
      .find({ where: { peoples: userId } });

    return response.data;
  }
);

const initialState: { workspaces: Workspace[]; loading: boolean } = {
  workspaces: [],
  loading: true,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchWorkspaces.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      fetchWorkspaces.fulfilled,
      (state, action: PayloadAction<Workspace[]>) => {
        state.workspaces = action.payload;
        state.loading = false;
      }
    );
    builder.addCase(fetchWorkspaces.rejected, (state) => {
      state.loading = false;
    });
  },
});

export const workspaceReducer = workspaceSlice.reducer;
