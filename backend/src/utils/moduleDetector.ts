
export const getModuleFromFilePath = (filePath: string): string => {
    const parts = filePath.split('/');
    if (parts.length === 1) {
        return 'root';
    }

    // If the path starts with 'src/', use the next directory as the module name
    if (parts[0] === 'src' && parts.length > 2) {
        return parts[1];
    }

    // Otherwise, use the top-level directory
    return parts[0];
};

export const getModulesFromFilePaths = (filePaths: string[]): string[] => {
    const modules = new Set<string>();

    for (const filePath of filePaths) {
        modules.add(getModuleFromFilePath(filePath));
    }

    return Array.from(modules);
};
