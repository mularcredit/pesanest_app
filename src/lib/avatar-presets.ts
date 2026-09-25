// Fixed seed strings for the avatar picker. Each seed deterministically
// produces one react-nice-avatar look via genConfig(seed). These must never
// change once a user has saved one — a saved avatarSeed value is looked up
// against this same string, and changing it would change everyone's saved
// avatar.
export const AVATAR_PRESET_SEEDS = [
    "avatar-aurora",
    "avatar-blaze",
    "avatar-cobalt",
    "avatar-dune",
    "avatar-ember",
    "avatar-flint",
    "avatar-grove",
    "avatar-harbor",
    "avatar-indigo",
    "avatar-juniper",
    "avatar-koa",
    "avatar-lumen",
    // Appended later to widen the gallery — never reorder or remove entries
    // above, since existing users' saved avatarSeed values point at them.
    "avatar-meridian",
    "avatar-nectar",
    "avatar-onyx",
    "avatar-pinnacle",
    "avatar-quartz",
    "avatar-ridge",
    "avatar-summit",
    "avatar-terra",
    "avatar-umber",
    "avatar-violet",
    "avatar-willow",
    "avatar-xenon",
    "avatar-yonder",
    "avatar-zephyr",
    "avatar-brook",
    "avatar-cascade",
    "avatar-delta",
    "avatar-echo",
    "avatar-fable",
    "avatar-glimmer",
    "avatar-horizon",
    "avatar-isle",
] as const;
