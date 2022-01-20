import React, { useEffect, useMemo, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";
import { BiSearch } from "react-icons/bi";
import { useDebounce } from "use-debounce";

import SolidBadge from "components/Badge/SolidBadge";
import Button from "components/Button/Button";
import BrowseChannelList from "./List";

import { useAppDispatch } from "hooks/useAppDispatch";
import { useAppSelector } from "hooks/useAppSelector";
import { useToast } from "hooks/useToast";

import { addChannel } from "features/channels/slice";
import { kontenbase } from "lib/client";
import { Channel } from "types";

type TProps = {
  onAddNewChannel: () => void;
  onClose: () => void;
};

type SearchType = "toJoin" | "joined";

function BrowseChannels({ onAddNewChannel, onClose }: TProps) {
  const [showToast] = useToast();

  const params = useParams();
  const navigate = useNavigate();

  const auth = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  const [searchType, setSearchType] = useState<SearchType>("toJoin");
  const [channelList, setChannelList] = useState<Channel[]>([]);

  const [search, setSearch] = useState("");
  const [searchDebounce] = useDebounce(search, 100);

  const channels = useMemo(() => {
    const trimValue = searchDebounce.trim();
    if (trimValue) {
      return channelList.filter(
        (data) =>
          data.name.includes(trimValue) || data.description?.includes(trimValue)
      );
    }
    return channelList;
  }, [channelList, searchDebounce]);

  const getChannelsData = async () => {
    try {
      const { data, error } = await kontenbase.service("Channels").find({
        where: { workspace: params.workspaceId, privacy: { $ne: "private" } },
        select: ["name", "description", "members"],
      });
      if (error) throw new Error(error.message);

      const channelData: Channel[] = data;
      if (searchType === "toJoin") {
        setChannelList(
          channelData.filter((data) => !data.members.includes(auth.user._id))
        );
      } else {
        setChannelList(
          channelData.filter((data) => data.members.includes(auth.user._id))
        );
      }
      setSearch("");
    } catch (error: any) {
      console.log("err", error);
      showToast({ message: `${JSON.stringify(error?.message)}` });
    }
  };

  useEffect(() => {
    getChannelsData();
  }, [searchType, params.workspaceId]);
  return (
    <div className="min-h-[30vh]">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 flex items-center">
          <BiSearch size={24} className="text-gray-400" />
          <input
            type="text"
            className="w-full outline-none ml-2"
            placeholder="Search by channel name or description"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          className="bg-indigo-600 text-white text-sm"
          onClick={onAddNewChannel}
        >
          New Channel
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <SolidBadge
          title="To Join"
          active={searchType === "toJoin"}
          onClick={() => setSearchType("toJoin")}
        />
        <SolidBadge
          title="Joined"
          active={searchType === "joined"}
          onClick={() => setSearchType("joined")}
        />
      </div>

      <div className="max-h-[30vh] overflow-auto mt-5">
        {channels?.map((data, idx) => (
          <BrowseChannelList
            key={idx}
            data={data}
            onClick={() => {
              if (searchType === "toJoin") {
                dispatch(addChannel(data));
              }
              navigate(`/a/${params.workspaceId}/ch/${data._id}`);
              onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default BrowseChannels;
