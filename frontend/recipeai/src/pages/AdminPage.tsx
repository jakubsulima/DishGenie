import React, { useCallback, useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/context";
import { apiClient, deleteClient, putClient } from "../lib/hooks";
import AdminRecipesPanel from "../components/AdminRecipesPanel";
import { AdminDashboardSkeleton } from "../components/Skeleton";
import ErrorAlert from "../components/ErrorAlert";
import PaginationControls from "../components/PaginationControls";

type SubscriptionPlan = "FREE" | "PAID";

interface User {
  id: number;
  email: string;
  role: string;
  subscriptionPlan?: SubscriptionPlan;
}

const AdminPage: React.FC = () => {
  const PAGE_SIZE = 20;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingPlanUserId, setUpdatingPlanUserId] = useState<number | null>(
    null,
  );
  const authContext = useContext(AuthContext);

  const fetchUsers = useCallback(
    async (pageNum: number = currentPage) => {
      setLoading(true);
      try {
        const data = await apiClient(
          `admin/users?page=${pageNum}&size=${PAGE_SIZE}`,
        );
        const pagedData =
          data && typeof data === "object"
            ? (data as { content?: User[]; totalPages?: number })
            : undefined;
        setUsers(Array.isArray(pagedData?.content) ? pagedData.content : []);
        setTotalPages(
          typeof pagedData?.totalPages === "number" ? pagedData.totalPages : 1,
        );
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [currentPage],
  );

  useEffect(() => {
    if (authContext?.user?.role === "ADMIN") {
      fetchUsers(currentPage);
    }
  }, [authContext?.user?.role, currentPage, fetchUsers]);

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await deleteClient(`admin/users/delete/${userId}`);
        if (users.length === 1 && currentPage > 0) {
          setCurrentPage((prev) => prev - 1);
        } else {
          fetchUsers(currentPage);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred while deleting user",
        );
        console.error(err);
      }
    }
  };

  const handlePlanChange = async (userId: number, plan: SubscriptionPlan) => {
    setUpdatingPlanUserId(userId);
    setError(null);
    try {
      const updatedUser: User = await putClient(`admin/users/${userId}/plan`, {
        plan,
      });
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId
            ? {
                ...user,
                subscriptionPlan: (updatedUser.subscriptionPlan ||
                  plan) as SubscriptionPlan,
              }
            : user,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while updating the user plan",
      );
      console.error(err);
    } finally {
      setUpdatingPlanUserId(null);
    }
  };

  if (authContext?.loading || loading) {
    return <AdminDashboardSkeleton rows={PAGE_SIZE} columns={5} />;
  }

  if (!authContext || authContext.user?.role !== "ADMIN") {
    return (
      <div className="container mx-auto p-4 bg-background min-h-screen text-accent">
        Access Denied. You must be an admin to view this page.
      </div>
    );
  }

  return (
    <div className="mobile-page-enter container mx-auto p-4 bg-background min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-text">Admin Dashboard</h1>
      <ErrorAlert
        message={error}
        className="mb-6"
        onAutoHide={() => setError(null)}
      />

      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-text">
          User Management
        </h2>
        {users.length === 0 && !error ? (
          <p className="text-text/70">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-secondary shadow-md rounded-lg">
              <thead className="bg-primary/10 text-text">
                <tr>
                  <th className="py-3 px-4 text-left">ID</th>
                  <th className="py-3 px-4 text-left">Email</th>
                  <th className="py-3 px-4 text-left">Role</th>
                  <th className="py-3 px-4 text-left">Plan</th>
                  <th className="py-3 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-primary/20 hover:bg-primary/5 transition-colors"
                  >
                    <td className="py-3 px-4">{user.id}</td>
                    <td className="py-3 px-4">{user.email}</td>
                    <td className="py-3 px-4">{user.role}</td>
                    <td className="py-3 px-4">
                      <select
                        value={user.subscriptionPlan || "FREE"}
                        onChange={(e) =>
                          handlePlanChange(
                            user.id,
                            e.target.value as SubscriptionPlan,
                          )
                        }
                        className="rounded border border-primary/30 bg-background px-2 py-1 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                        disabled={updatingPlanUserId === user.id}
                      >
                        <option value="FREE">FREE</option>
                        <option value="PAID">PAID</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="mobile-soft-press bg-accent hover:bg-accent/80 text-background font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={user.email === authContext.user?.email} // Prevent admin from deleting themselves
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Recipe Management Panel */}
      <AdminRecipesPanel />
    </div>
  );
};

export default AdminPage;
