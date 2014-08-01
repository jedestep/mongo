/*    Copyright 2014 MongoDB Inc.
 *
 *    This program is free software: you can redistribute it and/or  modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *    As a special exception, the copyright holders give permission to link the
 *    code of portions of this program with the OpenSSL library under certain
 *    conditions as described in each individual source file and distribute
 *    linked combinations including the program with the OpenSSL library. You
 *    must comply with the GNU Affero General Public License in all respects
 *    for all of the code used other than as permitted herein. If you modify
 *    file(s) with this exception, you may extend this exception to your
 *    version of the file(s), but you are not obligated to do so. If you do not
 *    wish to do so, delete this exception statement from your version. If you
 *    delete this exception statement from all source files in the program,
 *    then also delete it in the license file.
 */

#include "mongo/platform/basic.h"

#include "mongo/logger/log_tag.h"

#include "mongo/util/assert_util.h"

namespace mongo {
namespace logger {

    std::string LogTag::getShortName() const {
        switch (_value) {
        case kDefault: return "Default";
        case kAccessControl: return "AccessControl";
        case kCommands: return "Commands";
        case kIndexing: return "Indexing";
        case kJournalling: return "Journalling";
        case kNetworking: return "Networking";
        case kQuery: return "Query";
        case kReplication: return "Replication";
        case kSharding: return "Sharding";
        case kStorage: return "Storage";
        case kWrites: return "Writes";
        case kNumLogTags: return "Total";
        // No default. Compiler should complain if there's a tag that's not handled.
        }
        invariant(0);
    }

}  // logger
}  // mongo
