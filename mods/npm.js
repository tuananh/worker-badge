import millify from "millify";
import serveBadge from "../helpers/serve-badge";
import cachedExecute from "../helpers/cached-execute";

async function download(period, pkgName, tag = "latest") {
  const urlFragments = ["https://api.npmjs.org/downloads"];
  const isTotal = period === "total";

  if (isTotal) {
    urlFragments.push(`range/2005-01-01:${new Date().getFullYear() + 1}-01-01`);
  } else {
    urlFragments.push(`point/${period}`);
  }

  urlFragments.push(pkgName);
  // endpoint.push(tag)
  const url = urlFragments.join("/");
  let resp;
  try {
    resp = await fetch(url);
  } catch (err) {
    console.log("error fetch from npm", err);
  }
  if (resp && resp.status === 200) {
    const { downloads } = await resp.json();
    const count =
      typeof downloads === "number"
        ? downloads
        : downloads.reduce((accu, { downloads }) => {
            return accu + downloads;
          }, 0);

    const per = isTotal ? "" : period.replace("last-", "/");
    return {
      subject: "downloads",
      status: millify(count) + per,
      color: "green",
    };
  } else {
    return {
      subject: "downloads",
      status: "unknown",
      color: "grey",
    };
  }
}

async function pkgJson(pkgName, tag = "latest") {
  // const endpoint = `https://cdn.jsdelivr.net/npm/${pkg}@${tag}/package.json`
  const url = `https://unpkg.com/${pkgName}@${tag}/package.json`;
  return (await fetch(url)).json();
}

async function typesDefinition(pkgName, tag = "latest") {
  let meta = await pkgJson(pkgName, tag);

  if (typeof meta.types === "string" || typeof meta.typings === "string") {
    return {
      subject: "types",
      status: "included",
      color: "0074c1",
    };
  }

  const hasIndexDTSFile = await got
    .head(`https://unpkg.com/${pkgName}/index.d.ts`)
    .then((res) => res.statusCode === 200)
    .catch((e) => false);

  if (hasIndexDTSFile) {
    return {
      subject: "types",
      status: "included",
      color: "0074c1",
    };
  }

  const typesPkg =
    "@types/" +
    (pkgName.charAt(0) === "@" ? pkgName.slice(1).replace("/", "__") : pkgName);
  meta = await pkgJson(typesPkg).catch((e) => false);

  if (meta && meta.name === typesPkg) {
    return {
      subject: "types",
      status: meta.name,
      color: "cyan",
    };
  }

  return {
    subject: "types",
    status: "missing",
    color: "orange",
  };
}

async function handleNpm(request) {
  const { pathname } = new URL(request.url);
  const parts = pathname.split("/");
  if (parts.length > 3) {
    const topic = parts[2];
    const pkgName = parts[3];
    switch (topic) {
      case "v":
        try {
          const val = await cachedExecute({
            key: pathname,
            json: true,
            loadFn: async () => {
              const resp = await fetch(
                `https://registry.npmjs.org/-/package/${pkgName}/dist-tags`
              );
              if (resp.status === 200) {
                return resp.json();
              }

              if (resp.status === 404) {
                throw new Error("pkg not found");
              }

              throw new Error("bad response from npm");
            },
          });
          return serveBadge({ label: "npm", status: val.latest });
        } catch (err) {
          if (err.message === "pkg not found") {
            return serveBadge({ label: "npm", status: "pkg not found" });
          } else {
            return serveBadge({ label: "npm", status: "unknown" });
          }
        }
      case "license":
        const info = await cachedExecute({
          key: pathname,
          json: true,
          loadFn: async () => pkgJson(pkgName, "latest"),
        });
        return serveBadge({ label: "license", status: info.license });
      case "dt":
        return serveBadge(await download("total", pkgName));
      case "dd":
        return serveBadge(await download("last-day", pkgName)); // might deprecate this
      case "dw":
        return serveBadge(await download("last-week", pkgName));
      case "dm":
        return serveBadge(await download("last-month", pkgName));
      case "dy":
        return serveBadge(await download("last-year", pkgName));
      case "types":
        const def = await cachedExecute({
          key: pathname,
          json: true,
          loadFn: async () => typesDefinition(pkgName, "latest"),
        });
        return serveBadge({ ...def, label: "types" });
      default:
        return serveBadge({
          label: "npm",
          status: "unknown topic",
          color: "grey",
        });
    }
  }

  return serveBadge({ label: "npm", status: "unknown topic", color: "grey" });
}

export default handleNpm;
