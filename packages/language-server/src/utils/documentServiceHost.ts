import { LanguageServerInitializationOptions, LanguageServerPlugin, RuntimeEnvironment } from '../types';
import * as embedded from '@volar/language-service';
import { URI } from 'vscode-uri';
import { loadCustomPlugins } from './config';

// fix build
import type * as _ from 'vscode-languageserver-textdocument';

export function createDocumentServiceHost(
	runtimeEnv: RuntimeEnvironment,
	plugins: ReturnType<LanguageServerPlugin>[],
	ts: typeof import('typescript/lib/tsserverlibrary'),
	configHost: embedded.ConfigurationHost | undefined,
	initOptions: LanguageServerInitializationOptions,
) {

	const workspaceServices = new Map<string, embedded.DocumentService>();
	const untitledService = create(URI.from({ scheme: 'untitled' }));

	return {
		add,
		remove,
		get,
	};

	function add(rootUri: URI) {
		workspaceServices.set(rootUri.toString(), create(rootUri));
	}

	function remove(rootUri: URI) {
		workspaceServices.delete(rootUri.toString());
	}

	function get(documentUri: string) {
		for (const [rootUri, service] of workspaceServices) {
			if (documentUri.startsWith(rootUri)) {
				return service;
			}
		}
		return untitledService;
	}

	function create(rootUri: URI) {
		const env: embedded.LanguageServicePluginContext['env'] = {
			rootUri,
			configurationHost: configHost,
			fileSystemProvider: runtimeEnv.fileSystemProvide,
		};
		const serviceContext = embedded.createDocumentServiceContext({
			ts,
			env,
			getLanguageModules() {
				return plugins.map(plugin => plugin.syntacticService?.getLanguageModules?.(ts, env) ?? []).flat();
			},
			getPlugins() {
				return [
					...loadCustomPlugins(rootUri.fsPath, initOptions.configFilePath),
					...plugins.map(plugin => plugin.syntacticService?.getServicePlugins?.(serviceContext) ?? []).flat(),
				];
			},
		});
		return embedded.createDocumentService(serviceContext);
	}
}
