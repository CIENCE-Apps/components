import {
  getFetchConfig,
  handleError,
  handleResponse,
  getMiddlewareApiUrl,
} from "../methods/api";
import type {
  MailboxQuery,
  Thread,
  ConversationQuery,
  Conversation,
  MiddlewareResponse,
  SearchResultThreadsQuery,
  CommonQuery,
} from "@commons/types/Nylas";

export const fetchThreads = async (
  query: MailboxQuery,
  limit: number,
  offset: number,
): Promise<Thread[]> => {
  let queryString = `${getMiddlewareApiUrl(
    query.component_id,
  )}/threads?view=expanded&not_in=trash&limit=${limit}&offset=${offset}`;
  if (query.query) {
    Object.entries(query.query).forEach(
      (param) => (queryString = queryString.concat(`&${param[0]}=${param[1]}`)),
    );
  }
  return await fetch(queryString, getFetchConfig(query))
    .then((response) => handleResponse<MiddlewareResponse<Thread[]>>(response))
    .then((json) => json.response)
    .catch((error) => handleError(query.component_id, error));
};

export async function fetchThreadCount(query: MailboxQuery) {
  let queryString = `${getMiddlewareApiUrl(
    query.component_id,
  )}/threads?view=expanded&not_in=trash&view=count`;
  if (query.query) {
    Object.entries(query.query).forEach(
      (param) => (queryString = queryString.concat(`&${param[0]}=${param[1]}`)),
    );
  }

  if (query.keywordToSearch) {
    queryString += `&q=${query.keywordToSearch}`;
  }

  return await fetch(queryString, getFetchConfig(query))
    .then((response) => handleResponse<MiddlewareResponse<any>>(response))
    .then((json) => json.response.count);
}

export const fetchSearchResultThreads = async (
  query: MailboxQuery,
): Promise<Thread[]> => {
  const queryString = `${getMiddlewareApiUrl(
    query.component_id,
  )}/threads/search?q=${query.keywordToSearch}&view=expanded`;
  return await fetch(queryString, getFetchConfig(query))
    .then((response) => handleResponse<MiddlewareResponse<Thread[]>>(response))
    .then(async (json) => {
      return json.response;
    })
    .catch((error) => handleError(query.component_id, error));
};

export const fetchThread = async (
  query: ConversationQuery,
): Promise<Conversation> => {
  const thread = await fetch(
    `${getMiddlewareApiUrl(query.component_id)}/threads/${
      query.thread_id
    }?view=expanded`,
    getFetchConfig({
      component_id: query.component_id,
      access_token: query.access_token,
    }),
  )
    .then((response) =>
      handleResponse<MiddlewareResponse<Conversation>>(response),
    )
    .then((json) => {
      return json.response;
    })
    .catch((error) => handleError(query.component_id, error));

  return thread;
};

export const updateThread = async (
  query: ConversationQuery,
  updatedThread: Conversation,
): Promise<Conversation> => {
  // accepts unread, starred, folder_id + label_ids. developer.nylas.com/docs/api/#put/threads/id
  return fetch(
    `${getMiddlewareApiUrl(query.component_id)}/threads/${updatedThread.id}`,
    getFetchConfig({
      method: "PUT",
      component_id: query.component_id,
      access_token: query.access_token,
      body: {
        unread: updatedThread.unread,
        starred: updatedThread.starred,
        folder_id: updatedThread.folder_id,
        label_ids: updatedThread.label_ids,
      },
    }),
  )
    .then((response) =>
      handleResponse<MiddlewareResponse<Conversation>>(response),
    )
    .then((json) => {
      return json.response;
    })
    .catch((error) => handleError(query.component_id, error));
};
