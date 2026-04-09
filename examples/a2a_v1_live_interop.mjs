import { A2AJsonRpcClient, A2AJsonRpcError } from "@talosprotocol/sdk";

function parseArgs(argv) {
  const options = {
    gatewayUrl: "http://127.0.0.1:8000",
    apiToken: undefined,
    prompt: undefined,
    interopProfile: "canonical",
    returnImmediately: false,
    exerciseStreams: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--gateway-url") {
      options.gatewayUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--api-token") {
      options.apiToken = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--prompt") {
      options.prompt = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--interop-profile") {
      options.interopProfile = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--return-immediately") {
      options.returnImmediately = true;
      continue;
    }
    if (token === "--exercise-streams") {
      options.exerciseStreams = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function printHelp() {
  console.log(`Talos A2A v1 live interop smoke

Options:
  --gateway-url <url>       Gateway base URL (default: http://127.0.0.1:8000)
  --api-token <token>       Bearer token for the gateway
  --prompt <text>           Optional prompt to send via SendMessage
  --interop-profile <mode>  canonical, upstream_v0_3, or upstream_java_hybrid
  --return-immediately      Set configuration.returnImmediately on send requests
  --exercise-streams        Also exercise SendStreamingMessage and SubscribeToTask
  -h, --help                Show this help text
`);
}

function pretty(title, payload) {
  console.log(`\n== ${title} ==`);
  console.log(JSON.stringify(payload, null, 2));
}

function note(title, reason) {
  pretty(title, { skipped: true, reason });
}

function supportsAuthenticatedExtendedCard(card) {
  return Boolean(card && typeof card === "object" && card.supportsAuthenticatedExtendedCard);
}

function supportsExtendedAgentCard(card) {
  return Boolean(
    card &&
      typeof card === "object" &&
      card.capabilities &&
      typeof card.capabilities === "object" &&
      card.capabilities.extendedAgentCard,
  );
}

function taskIdFromSendResult(payload) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  if (payload.task && typeof payload.task === "object" && typeof payload.task.id === "string") {
    return payload.task.id;
  }
  if (payload.kind === "task" && typeof payload.id === "string") {
    return payload.id;
  }
  return undefined;
}

async function collect(stream) {
  const events = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = new A2AJsonRpcClient(args.gatewayUrl, {
    apiToken: args.apiToken,
    interopProfile: args.interopProfile,
  });

  try {
    const card = await client.getAgentCard();
    pretty("Agent Card", card);
    if (!supportsExtendedAgentCard(card)) {
      note("Extended Agent Card", "Skipped because the target agent card does not advertise extended discovery");
      note(
        "Authenticated Extended Agent Card",
        "Skipped because the target agent card does not advertise extended discovery",
      );
    } else if (args.interopProfile === "upstream_v0_3" && !supportsAuthenticatedExtendedCard(card)) {
      note(
        "Extended Agent Card",
        "Skipped because the target agent card does not advertise authenticated extended discovery",
      );
      note(
        "Authenticated Extended Agent Card",
        "Skipped because the target agent card does not advertise authenticated extended discovery",
      );
    } else {
      pretty("Extended Agent Card", await client.getExtendedAgentCard());
      pretty("Authenticated Extended Agent Card", await client.getAuthenticatedExtendedAgentCard());
    }
    if (args.interopProfile === "upstream_v0_3") {
      note("Task List", "Skipped for upstream_v0_3 because tasks/list is not guaranteed upstream");
    } else if (args.interopProfile === "upstream_java_hybrid") {
      note(
        "Task List",
        "Skipped for upstream_java_hybrid because the official Java sample exposes a mixed task surface",
      );
    } else {
      pretty("Task List", await client.listTasks({ pageSize: 5 }));
    }

    if (args.prompt) {
      const sendResult = await client.sendMessage(args.prompt, {
        configuration: { returnImmediately: args.returnImmediately },
      });
      pretty("Send Message", sendResult);

      const taskId = taskIdFromSendResult(sendResult);
      if (typeof taskId === "string") {
        try {
          pretty("Get Task", await client.getTask(taskId, { includeArtifacts: true }));
        } catch (error) {
          if (!(error instanceof A2AJsonRpcError) || args.interopProfile !== "upstream_v0_3" || error.code !== -32601) {
            throw error;
          }
          note("Get Task", "Skipped for upstream_v0_3 because tasks/get is not implemented by the target");
        }
      } else {
        note("Get Task", "Skipped because SendMessage did not return a task id");
      }

      if (args.exerciseStreams) {
        pretty(
          "Send Streaming Message",
          await collect(
            client.sendStreamingMessage(args.prompt, {
              configuration: { returnImmediately: args.returnImmediately },
            }),
          ),
        );
        if (typeof taskId !== "string") {
          note("Subscribe To Task", "Skipped because SendMessage did not return a task id");
        } else {
          try {
            pretty("Subscribe To Task", await collect(client.subscribeToTask(taskId)));
          } catch (error) {
            if (!(error instanceof A2AJsonRpcError) || args.interopProfile !== "upstream_v0_3" || error.code !== -32601) {
              throw error;
            }
            note(
              "Subscribe To Task",
              "Skipped for upstream_v0_3 because tasks/resubscribe is not implemented by the target",
            );
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof A2AJsonRpcError) {
      console.error(
        JSON.stringify(
          { error: { code: error.code, message: error.message, data: error.data } },
          null,
          2,
        ),
      );
      process.exit(1);
    }
    throw error;
  }
}

await main();
