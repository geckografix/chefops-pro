import { ironSessionOptions } from "iron-session";

export const sessionOptions = {
  cookieName: "chefops_session",
  password:
    process.env.SESSION_PASSWORD ||
    "DEV_ONLY_CHANGE_ME_DEV_ONLY_CHANGE_ME_DEV_ONLY_CHANGE_ME",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
} satisfies typeof ironSessionOptions;

export type SessionUser = {
  userId: string;
  email: string;
  activePropertyId?: string;
};

declare module "iron-session" {
  interface IronSessionData {
    user?: SessionUser;
  }
}
