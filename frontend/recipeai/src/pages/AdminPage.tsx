import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthContext } from "../context/context";
import { apiClient, deleteClient, putClient } from "../lib/hooks";
import AdminRecipesPanel from "../components/AdminRecipesPanel";
import { AdminDashboardSkeleton } from "../components/Skeleton";
import ErrorAlert from "../components/ErrorAlert";
import PaginationControls from "../components/PaginationControls";
import type {
  AdminRole,
  AdminUser,
  PageResponse,
  SubscriptionPlan,
  UserRecipeFilter,
} from "../lib/adminTypes";
import { useLanguage } from "../context/languageContext";

const PAGE_SIZE = 20;

const rolePermissions: Record<AdminRole, string[]> = {
  USER: [
    "Create and manage own recipes",
    "Generate recipes within plan limits",
    "Manage own preferences",
  ],
  ADMIN: [
    "All user permissions",
    "Manage users, roles, and plans",
    "View, edit, and delete recipes",
    "Bypass daily recipe generation limits",
  ],
};

const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [selectedUserRecipes, setSelectedUserRecipes] =
    useState<UserRecipeFilter | null>(null);
  const authContext = useContext(AuthContext);
  const { t } = useLanguage();

  const fetchUsers = useCallback(async (pageNum: number = currentPage) => {
    setLoading(true);
    try {
      const data = await apiClient<PageResponse<AdminUser>>(
        `admin/users?page=${pageNum}&size=${PAGE_SIZE}`,
      );
      setUsers(Array.isArray(data.content) ? data.content : []);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
      setTotalUsers(
        typeof data.totalElements === "number" ? data.totalElements : 0,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    if (authContext?.user?.role === "ADMIN") {
      fetchUsers(currentPage);
    }
  }, [authContext?.user?.role, currentPage, fetchUsers]);

  const visibleStats = useMemo(() => {
    const admins = users.filter((user) => user.role === "ADMIN").length;
    const paid = users.filter((user) => user.subscriptionPlan === "PAID").length;
    return {
      admins,
      users: users.length - admins,
      paid,
      free: users.length - paid,
    };
  }, [users]);

  const handleDeleteUser = async (user: AdminUser) => {
    if (
      !window.confirm(
        t("Delete {email}? Their account and owned data will be removed.", { email: user.email }),
      )
    ) {
      return;
    }

    setUpdatingUserId(user.id);
    setError(null);
    try {
      await deleteClient(`admin/users/delete/${user.id}`);
      if (selectedUserRecipes?.id === user.id) {
        setSelectedUserRecipes(null);
      }
      if (users.length === 1 && currentPage > 0) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await fetchUsers(currentPage);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while deleting user",
      );
      console.error(err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handlePlanChange = async (user: AdminUser, plan: SubscriptionPlan) => {
    setUpdatingUserId(user.id);
    setError(null);
    try {
      const updatedUser = (await putClient(`admin/users/${user.id}/plan`, {
        plan,
      })) as AdminUser;
      updateUserInState(user.id, {
        subscriptionPlan: updatedUser.subscriptionPlan || plan,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while updating the user plan",
      );
      console.error(err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRoleChange = async (user: AdminUser, role: AdminRole) => {
    if (user.role === role) {
      return;
    }

    if (
      role !== "ADMIN" &&
      !window.confirm(t("Remove admin permissions from {email}?", { email: user.email }))
    ) {
      return;
    }

    setUpdatingUserId(user.id);
    setError(null);
    try {
      const updatedUser = (await putClient(
        `admin/users/${user.id}/role`,
        role,
      )) as AdminUser;
      updateUserInState(user.id, { role: updatedUser.role || role });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while updating the user role",
      );
      console.error(err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const updateUserInState = (userId: number, patch: Partial<AdminUser>) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === userId ? { ...user, ...patch } : user,
      ),
    );
  };

  if (authContext?.loading || loading) {
    return <AdminDashboardSkeleton rows={PAGE_SIZE} columns={6} />;
  }

  if (!authContext || authContext.user?.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-background p-4 text-accent">
        {t("Access denied. You must be an admin to view this page.")}
      </div>
    );
  }

  return (
    <div className="mobile-page-enter min-h-screen bg-background px-4 py-6 text-text">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("Admin Dashboard")}</h1>
            <p className="mt-1 text-sm text-text/70">
              {t("Manage users, permissions, plans, and recipes.")}
            </p>
          </div>
          <div className="text-sm text-text/70">
            {t("Signed in as")} {" "}
            <span className="font-semibold text-text">
              {authContext.user.email}
            </span>
          </div>
        </header>

        <ErrorAlert
          message={error ? t(error) : null}
          className="mb-6"
          onAutoHide={() => setError(null)}
        />

        <section className="mb-8 grid gap-3 md:grid-cols-4">
          <SummaryStat label={t("Total users")} value={totalUsers} />
          <SummaryStat label={t("Visible admins")} value={visibleStats.admins} />
          <SummaryStat label={t("Visible paid plans")} value={visibleStats.paid} />
          <SummaryStat label={t("Visible free plans")} value={visibleStats.free} />
        </section>

        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{t("Users & Permissions")}</h2>
              <p className="mt-1 text-sm text-text/70">
                {t("Roles are enforced by the backend. The API blocks deleting or demoting the final admin.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchUsers(currentPage)}
              className="mobile-soft-press w-fit rounded bg-secondary px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10"
            >
              {t("Refresh")}
            </button>
          </div>

          {users.length === 0 && !error ? (
            <p className="text-text/70">{t("No users found.")}</p>
          ) : (
            <div className="overflow-x-auto rounded border border-primary/20">
              <table className="min-w-full bg-secondary">
                <thead className="bg-primary/10 text-sm text-text">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">{t("Role")}</th>
                    <th className="px-4 py-3 text-left">{t("Plan")}</th>
                    <th className="px-4 py-3 text-left">{t("Permissions")}</th>
                    <th className="px-4 py-3 text-left">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-text">
                  {users.map((user) => {
                    const isSelf = user.email === authContext.user?.email;
                    const disabled = updatingUserId === user.id;

                    return (
                      <tr
                        key={user.id}
                        className="border-t border-primary/15 align-top transition-colors hover:bg-primary/5"
                      >
                        <td className="px-4 py-3">{user.id}</td>
                        <td className="px-4 py-3 font-medium">{user.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={user.role}
                            onChange={(event) =>
                              handleRoleChange(user, event.target.value as AdminRole)
                            }
                            className="rounded border border-primary/30 bg-background px-2 py-1 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                            disabled={disabled || isSelf}
                            title={
                              isSelf
                                ? t("Use another admin account to change your own role")
                                : t("Change user role")
                            }
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={user.subscriptionPlan || "FREE"}
                            onChange={(event) =>
                              handlePlanChange(
                                user,
                                event.target.value as SubscriptionPlan,
                              )
                            }
                            className="rounded border border-primary/30 bg-background px-2 py-1 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                            disabled={disabled}
                          >
                            <option value="FREE">FREE</option>
                            <option value="PAID">PAID</option>
                          </select>
                        </td>
                        <td className="max-w-md px-4 py-3 text-text/75">
                          {rolePermissions[user.role]
                            .map((permission) => t(permission))
                            .join(" · ")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedUserRecipes({
                                  id: user.id,
                                  email: user.email,
                                })
                              }
                              className="mobile-soft-press rounded bg-background px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10"
                            >
                              {t("Recipes")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              className="mobile-soft-press rounded bg-accent px-3 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={disabled || isSelf}
                            >
                              {t("Delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </section>

        <AdminRecipesPanel
          userFilter={selectedUserRecipes}
          onClearUserFilter={() => setSelectedUserRecipes(null)}
        />
      </div>
    </div>
  );
};

const SummaryStat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded border border-primary/20 bg-secondary p-4">
    <div className="text-sm text-text/65">{label}</div>
    <div className="mt-1 text-2xl font-bold text-text">{value}</div>
  </div>
);

export default AdminPage;
