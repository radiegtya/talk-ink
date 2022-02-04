import React, { useMemo, useEffect, useState, useRef } from "react";

import { Link } from "react-router-dom";
import { useParams, useLocation } from "react-router";
import Editor from "rich-markdown-editor";
import ReactMoment from "react-moment";
import { useRemirror } from "@remirror/react";

import MainContentContainer from "components/MainContentContainer/MainContentContainer";
import MainContentHeader from "components/MainContentContainer/MainContentHeader";
import CommentList from "components/Comment/List";
import CommentForm from "components/Comment/Form";
import Avatar from "components/Avatar/Avatar";
import LoadingSkeleton from "components/Loading/ContentSkeleton";
import Remirror from "components/Remirror";

import { Channel, Thread, Member, ISubComment } from "types";
import { useAppSelector } from "hooks/useAppSelector";
import {
  addComment,
  deleteComment,
  updateComment,
  addInteractedUser,
} from "features/threads";

import { fetchComments } from "features/threads/slice/asyncThunk";
import { useAppDispatch } from "hooks/useAppDispatch";
import { kontenbase } from "lib/client";
import { useToast } from "hooks/useToast";
import { updateUser } from "features/auth";
import NameInitial from "components/Avatar/NameInitial";
import { getNameInitial } from "utils/helper";
import { KontenbaseResponse, KontenbaseSingleResponse } from "@kontenbase/sdk";

import { extensions } from "components/Remirror/extensions";
import { htmlToProsemirrorNode } from "remirror";

function useQuery() {
  const { search } = useLocation();

  return React.useMemo(() => new URLSearchParams(search), [search]);
}

function ThreadPage() {
  const [showToast] = useToast();
  const auth = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const query = useQuery();
  const { threadId, workspaceId, channelId } = useParams();

  const thread = useAppSelector((state) => state.thread);
  const channel = useAppSelector((state) => state.channel);
  const member = useAppSelector((state) => state.member);

  const listRef = useRef<HTMLDivElement>(null);
  const [memberList, setMemberList] = useState<Member[]>([]);
  const [isShowEditor, setIsShowEditor] = useState<boolean>(false);

  const [showTitle, setShowTitle] = useState<boolean>(false);

  const channelData: Channel = useMemo(() => {
    return channel.channels.find((data) => data._id === channelId);
  }, [channelId, channel.channels]);

  const threadData: Thread = useMemo(() => {
    return thread.threads.find((data) => data._id === threadId);
  }, [thread.threads, threadId]);

  const { manager, state, onChange, setState } = useRemirror({
    extensions: () => extensions(true),
    stringHandler: htmlToProsemirrorNode,
    content: JSON.parse(threadData?.content).doc,
  });

  useEffect(() => {
    let key: string;

    kontenbase.realtime
      .subscribe("Comments", { event: "*" }, async (message) => {
        const { payload, event } = message;
        const isCurrentThread =
          event === "UPDATE_RECORD"
            ? payload.before.threads?.[0] === threadId
            : payload.threads?.[0] === threadId;

        let _createdBy;
        let _subComments;
        if (event === "CREATE_RECORD" || event === "UPDATE_RECORD") {
          try {
            const { data, error } = await kontenbase.service("Users").find({
              where: {
                id:
                  event === "UPDATE_RECORD"
                    ? payload.before.createdBy
                    : payload.createdBy,
              },
            });

            if (error) throw new Error(error.message);

            _createdBy = data?.[0];
          } catch (error) {
            if (error instanceof Error) {
              showToast({ message: `${JSON.stringify(error?.message)}` });
            }
          }

          if (
            event === "UPDATE_RECORD" &&
            payload.after.subComments.length > 0
          ) {
            try {
              const { data, error }: KontenbaseResponse<ISubComment> =
                await kontenbase.service("SubComments").find({
                  where: {
                    parent: payload.after._id,
                  },
                });

              if (error) throw new Error(error.message);

              _subComments = data.map((item) => ({
                ...item,
                createdBy: item.createdBy._id,
              }));
            } catch (error) {
              if (error instanceof Error) {
                showToast({ message: `${JSON.stringify(error?.message)}` });
              }
            }
          }
        }

        if (isCurrentThread) {
          switch (event) {
            case "CREATE_RECORD":
              dispatch(
                addComment({
                  threadId,
                  comment: { ...payload, createdBy: _createdBy },
                })
              );

              break;
            case "UPDATE_RECORD":
              dispatch(
                updateComment({
                  threadId,
                  comment: {
                    ...payload.before,
                    ...payload.after,
                    createdBy: _createdBy,
                    subComments: _subComments,
                  },
                })
              );
              break;
            default:
              break;
          }
        }

        if (event === "DELETE_RECORD") {
          dispatch(
            deleteComment({
              threadId,
              deletedId: payload._id,
            })
          );
        }
      })
      .then((result) => (key = result));

    return () => {
      kontenbase.realtime.unsubscribe(key);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateReadedThreads = async () => {
    try {
      let readedThreads: string[] = [];
      if (auth.user?.readedThreads) {
        readedThreads = auth.user?.readedThreads;
      }
      if (!readedThreads.includes(threadId)) {
        await kontenbase
          .service("Threads")
          .link(threadId, { readedUsers: auth.user._id });

        dispatch(updateUser({ readedThreads: [...readedThreads, threadId] }));
      }
    } catch (error: any) {
      console.log("err", error);
      showToast({ message: `${JSON.stringify(error.message)}` });
    }
  };

  useEffect(() => {
    dispatch(fetchComments({ threadId: threadId, skip: 0 }));
  }, [dispatch, threadId]);

  const loadMoreComment = () => {
    dispatch(
      fetchComments({ threadId: threadId, skip: threadData.comments.length })
    );
  };

  useEffect(() => {
    updateReadedThreads(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const scrollToBottom = () =>
    setTimeout(() => {
      listRef?.current?.scrollIntoView({ behavior: "smooth" });
    }, 1000);

  useEffect(() => {
    if (threadData.comments?.length === 0) return;
    scrollToBottom();

    const timedId = scrollToBottom();

    return () => {
      clearTimeout(timedId);
    };
  }, [threadData.comments]);

  useEffect(() => {
    const setInteractedUser = async () => {
      try {
        const { data, error }: KontenbaseSingleResponse<Thread> =
          await kontenbase.service("Threads").getById(threadId);

        if (error) throw new Error(error.message);

        if (
          !data.interactedUsers?.find((item: any) => item === auth.user._id)
        ) {
          await kontenbase.service("Threads").link(threadId, {
            interactedUsers: auth.user._id,
          });

          dispatch(
            addInteractedUser({
              threadId: threadId,
              userId: auth.user._id,
            })
          );
        }
      } catch (error) {
        if (error instanceof Error) {
          showToast({ message: `${JSON.stringify(error?.message)}` });
        }
      }
    };

    setInteractedUser(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // const getMemberHandler = async () => {
  //   try {
  //     const memberList = await kontenbase.service("Users").find({
  //       where: { workspaces: workspaceId, channels: channelId },
  //       lookup: ["avatar"],
  //     });

  //     if (memberList.error) throw new Error(memberList.error.message);

  //     if (memberList.data) {
  //       setMemberList(memberList.data);
  //     }
  //   } catch (error) {
  //     if (error instanceof Error) {
  //       showToast({ message: `${JSON.stringify(error?.message)}` });
  //     }
  //   }
  // };

  useEffect(() => {
    // getMemberHandler();
    setMemberList(member.members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.members]);

  // useEffect(() => {
  //   dispatch(fetchChannels({ userId: auth.user._id, workspaceId }));
  // }, [workspaceId]);

  return (
    <MainContentContainer
      header={
        <MainContentHeader
          channel={channelData?.name}
          title={threadData?.name}
          thread
          from={query.get("fromInbox") === "1" && "inbox"}
          showTitle={showTitle}
        />
      }
      onScroll={(e: any) => {
        if (e?.target?.scrollTop >= 120) {
          setShowTitle(true);
        } else {
          setShowTitle(false);
        }
      }}
    >
      <div className="max-w-4xl ml-auto mr-auto -mt-4">
        <div className="relative">
          <div className="mb-8">
            <h1 className="font-bold text-3xl max-w-3xl break-words">
              {threadData?.name}
            </h1>
            <p className="text-neutral-500 text-sm font-body">
              {channelData?.members?.length} Participants{" "}
              <Link
                to={`/a/${workspaceId}/ch/${channelId}`}
                className="text-blue-500"
              >
                #{channelData?.name}
              </Link>
            </p>
          </div>
          <div className="flex items-start">
            <div className="mr-4">
              {threadData?.createdBy?.avatar?.[0]?.url ? (
                <Avatar src={threadData?.createdBy?.avatar?.[0]?.url} />
              ) : (
                <NameInitial
                  name={getNameInitial(threadData?.createdBy?.firstName)}
                />
              )}
            </div>

            <div className="flex-grow text-sm">
              <div className="-mt-1.5 flex items-center justify-start">
                <p className=" font-semibold mb-0 mt-0 mr-2">
                  {threadData.createdBy?.firstName}
                </p>{" "}
                <p className="mb-0 mt-0 text-xs">
                  <ReactMoment format="DD/MM/YYYY LT">
                    {threadData?.updatedAt || threadData?.createdAt}
                  </ReactMoment>
                </p>
              </div>
              {threadData?.content && manager && (
                <Remirror
                  remmirorProps={{
                    manager,
                    state,
                    onChange,
                  }}
                  readOnly
                />
              )}
            </div>
          </div>
          <div className="border-t-[1px] border-gray-200 mb-8 mt-8" />
          {thread?.commentCount - threadData?.comments?.length > 0 && (
            <p
              className="text-sm mb-8 -mt-4 hover:opacity-80 hover:cursor-pointer"
              onClick={loadMoreComment}
            >
              View More {thread?.commentCount - threadData?.comments?.length}{" "}
              Comments
            </p>
          )}

          {/* <div className="mb-10 ">
            {thread.commentLoading ? (
              <LoadingSkeleton />
            ) : (
              <CommentList
                dataSource={threadData?.comments || []}
                listRef={listRef}
                memberList={memberList}
                threadId={threadId}
                threadName={threadData?.name}
              />
            )}
          </div>
          <CommentForm
            isShowEditor={isShowEditor}
            setIsShowEditor={setIsShowEditor}
            threadId={threadId}
            threadName={threadData?.name}
            interactedUsers={[...new Set(threadData?.interactedUsers)]}
            scrollToBottom={scrollToBottom}
            memberList={memberList}
          /> */}
        </div>
      </div>
    </MainContentContainer>
  );
}

export default ThreadPage;
