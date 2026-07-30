import { getUsers } from "./actions";
import { TeamClient } from "./TeamClient";

export default async function TeamPage() {
    const { data: users } = await getUsers();

    return <TeamClient initialUsers={users || []} />;
}
